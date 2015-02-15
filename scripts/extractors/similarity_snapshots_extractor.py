#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from subprocess import *
from git import *
import os.path
import os
from pymongo import MongoClient
from findtools.find_files import (find_files, Match)
from bson.objectid import ObjectId
import difflib
import tempfile

# cache contents
content_cache = {}

content_lines_cache = {}

# avoid unnecessary checkout
current_checkout_sha = None

# ratio cache
diff_cache = {}

# more caching
cache = {}

count = 0

# config
config = None

def extract_new(rp, st, tp, variation_dirs, repo, db, commits):
	global cache

	# build up cache
	pre_first_commit = commits[0]
	for p in pre_first_commit.parents:
		for similarity_snapshot in db.similaritySnapshots.find({'sha': p.hexsha}):
			ratio = similarity_snapshot['diff_ratio']
			cache[str(similarity_snapshot['target_id']) + str(similarity_snapshot['source_id'])] = ratio

	extract(rp, st, tp, variation_dirs, repo, db, commits, clear=False)

def extract(rp, st, tp, variation_dirs, repo, db, commits, clear=True):

	def find_variation_dir(rp, variation_dirs):
		for candidate in variation_dirs:
			full_candidate = os.path.join(rp, candidate)
			if os.path.isdir(full_candidate):
				return candidate
		return None

	def checkout(sha):
		global current_checkout_sha
		if current_checkout_sha != sha:
			repo.git.checkout(sha)
			current_checkout_sha = sha

	# get content of a fragment snapshot
	def get_fragment_snapshot_content(fragment, variation_dirs):
		global content_cache, content_lines_cache, config
		if not config:
			config = json.load(open(os.path.dirname(os.path.realpath(__file__)) + '/../config.json'))['fragments-tech']
		if fragment['_id'] in content_cache:
			return content_cache[fragment['_id']]
		checkout(fragment['sha'])
		variation_dir = find_variation_dir(rp, variation_dirs)
		path = os.path.join(rp, variation_dir, fragment['variant'], fragment['relative_path'])
		extension = os.path.splitext(fragment['relative_path'])[1][1:]
		with open(path) as f:
			content = ''.join(f.readlines()[(fragment['from'] - 1):fragment['to']])
			if extension in config and 'line-pp' in config[extension]:
				temp_f = tempfile.NamedTemporaryFile(delete=False)
				temp_f.write(content)
				temp_f.close()
				line_pp_path = os.path.join(tp, config[extension]['line-pp'])
				if hash(content) not in content_lines_cache:
					result = Popen([config[extension]['runner'], line_pp_path], stdin=open(temp_f.name), stdout=PIPE).communicate()[0]
					content_lines_cache[hash(content)] = result
				else:
					result = content_lines_cache[hash(content)]

				content = result
				os.unlink(temp_f.name)

			content_cache[fragment['_id']] = (content, hash(content))

			return (content, hash(content))


	# compute diff ratio of two fragment snapshots
	def diff_ratio(f1, f2, variation_dirs):
		(content_f1, hash_f1) = get_fragment_snapshot_content(f1, variation_dirs)
		(content_f2, hash_f2) = get_fragment_snapshot_content(f2, variation_dirs)
		hash_both = hash_f1 + hash_f2
		if hash_both in diff_cache:
			return diff_cache[hash_both]
		ratio = difflib.SequenceMatcher(None, content_f1, content_f2).ratio()
		diff_cache[hash_both] = ratio
		return ratio

	# lookup if of predecessor snapshot of given snapshot
	def old_id(fragment_snapshot, fragmentTracks, track_lookup):
		(track_index, track_inner_index) = track_lookup[fragment_snapshot['_id']]
		return fragmentTracks[track_index]["fragment_snapshot_ids"][track_inner_index - 1]

	flipped = {}

	# store diff ratio for a pair of snapshots
	def from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs, ratio=None):
		if fragment_snapshot['_id'] == other_fragment_snapshot['_id']:
			return None
		if ratio is None:
			ratio = diff_ratio(fragment_snapshot, other_fragment_snapshot, variation_dirs)
		if ratio < st:
			return None
		cache[str(fragment_snapshot['_id'])+str(other_fragment_snapshot['_id'])] = ratio	

		document = {}
		document['sha'] = commit.hexsha
		document['repo_path'] = rp
		document['source_id'] = other_fragment_snapshot['_id']
		document['source_variant'] = other_fragment_snapshot['variant']
		document['target_id'] = fragment_snapshot['_id']
		document['target_variant'] = fragment_snapshot['variant']

		h = str(fragment_snapshot['_id']) + str(other_fragment_snapshot['_id'])

		if h in flipped:
			avg_ratio = (ratio + flipped[h]['diff_ratio']) / 2
			document['diff_ratio'] = avg_ratio
			flipped[h]['diff_ratio'] = avg_ratio
			db.similaritySnapshots.insert(flipped[h])
			db.similaritySnapshots.insert(document)
		else:
			document['diff_ratio'] = ratio
			flipped[str(other_fragment_snapshot['_id']) + str(fragment_snapshot['_id'])] = document

	# copy from predecessor pair of snapshots
	def copy_from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs, fragment, track_lookup):
		old_id_fragment_snapshot = old_id(fragment_snapshot, fragmentTracks, track_lookup)
		old_id_other_fragment_snapshot = old_id(other_fragment_snapshot, fragmentTracks, track_lookup)
		key = str(old_id_fragment_snapshot)+str(old_id_other_fragment_snapshot)
		if key in cache:
			ratio = cache[key]
			from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs, ratio)

	# extract all similarities at a commit
	def from_commit(commit, all_fragment_snapshots, db, fragmentTracks, track_lookup):
		global content_cache, flipped
		content_cache = {}
		flipped = {}
		print '> ' + commit.hexsha
		variation_dir = find_variation_dir(rp, variation_dirs)
		# lookup current snapshots
		fragment_snapshots = filter(lambda f: f['sha'] == commit.hexsha, all_fragment_snapshots)
		print ' > ' + str(len(fragment_snapshots)) + ' fragments.'
		# if either snapshot marks a change, compute diff ratio, otherwise copy
		for fragment_snapshot in fragment_snapshots:
			if fragment_snapshot['is_new'] or fragment_snapshot['is_changed']:
				for other_fragment_snapshot in fragment_snapshots:
					from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs)
			else:
				for other_fragment_snapshot in fragment_snapshots:
					if other_fragment_snapshot['is_new'] or other_fragment_snapshot['is_changed']:
						from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs)
					else:
						copy_from_pair(fragment_snapshot, other_fragment_snapshot, variation_dirs, fragmentTracks, track_lookup)

	print 'Extracting from ' + str(len(commits)) +' commits.'
	# build lookup table for snapshot -> fragment
	all_fragment_snapshots = list(db.fragmentSnapshots.find({"repo_path": rp}))
	fragmentTracks = list(db.fragmentTracks.find({"repo_path": rp}))
	track_lookup = {}
	for index_i, track in enumerate(fragmentTracks):
		for index_j, fragment_snapshot_id in enumerate(track['fragment_snapshot_ids']):
			track_lookup[fragment_snapshot_id] = (index_i,index_j)


	# extract similarities from each commit
	if clear:
		db.similaritySnapshots.remove({'repo_path': rp})
	for idx, commit in enumerate(commits):
		print str(idx + 1) + '/' + str(len(commits))
		from_commit(commit, all_fragment_snapshots, db, fragmentTracks, track_lookup)
