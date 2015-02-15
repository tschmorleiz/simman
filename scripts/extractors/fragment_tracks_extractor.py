#! /usr/bin/env python
import json
import shutil
import operator
from datetime import datetime
from subprocess import *
import os.path
from bson import ObjectId
from findtools.find_files import (find_files, Match)
import sys

# avoid unnecessary checkout
current_checkout_sha = None

# cache contents
content_cache = {}

# extract fragment by means of a track of snapshots
tracks = {}

# references to tracks
refs = {}

# find the current variation directory
def find_variation_dir(rp, variation_dirs):
	for candidate in variation_dirs:
		full_candidate = os.path.join(rp, candidate)
		if os.path.isdir(full_candidate):
			return candidate
	return None

# get content of a fragment snapshot
def get_fragment_snapshot_content(fragment, rp, variation_dirs, repo):
	global current_checkout_sha, content_cache
	if fragment['_id'] in content_cache:
		return content_cache[fragment['_id']]
	if current_checkout_sha != fragment['sha']:
		repo.git.checkout(fragment['sha'])
		current_checkout_sha = fragment['sha']
	variation_dir = find_variation_dir(rp, variation_dirs)
	path = os.path.join(rp, variation_dir, fragment['variant'], fragment['relative_path'])
	with open(path) as f:
		content = ''.join(f.readlines()[(fragment['from'] - 1):fragment['to']])
		content_cache[fragment['_id']] = content
		return content

# track a fragment snapshot by linking into to an older snapshot, also set flags
def track_fragment_snapshot(fragment, last_fragments, fragments, commit, moves, rp, variation_dirs, repo):
	file_path = '/'.join([fragment['variant'], fragment['relative_path']])
	# filter relevant moves
	relevant_moves = filter(lambda move: move[1] == file_path, moves)
	# extract old variant and relative path
	if len(relevant_moves) > 0:
		old_variant = relevant_moves[0][0].split(os.sep)[0]
		old_rel_path = os.path.relpath(relevant_moves[0][0], old_variant)
	else:
		old_variant = fragment['variant']
		old_rel_path = fragment['relative_path']
	# extract relevant fragment snapshots from last commit
	relevant_last_fragments = filter(lambda last_fragment:
		last_fragment['variant'] == old_variant and
		   last_fragment['relative_path'] == old_rel_path
		, last_fragments)
	# extend to variant
	relevant_last_fragments_wide = filter(lambda last_fragment:
		last_fragment['variant'] == old_variant
		, last_fragments)
	# extract all fragment snapshots in same variant
	relevant_fragments = filter(lambda f:
		f['variant'] == fragment['variant']
		, fragments)
	# extract old fragment snapshot names
	old_fragment_names = map(lambda f: f['name'], relevant_last_fragments_wide)
	# extract current fragment snapshot names
	new_fragment_names = map(lambda f: f['name'], relevant_fragments)
	fragment_names = old_fragment_names + new_fragment_names
	fragment_names.sort(key=len, reverse=True)

	# save candidate snapshot to link to
	candidate = None

	# check all last fragment snapshots
	for last_fragment in relevant_last_fragments:
		sys.stdout.write('.')
		sys.stdout.flush()

		# get contents
		last_fragment_content = get_fragment_snapshot_content(last_fragment, rp, variation_dirs, repo).decode('utf-8')
		fragment_content = get_fragment_snapshot_content(fragment, rp, variation_dirs, repo).decode('utf-8')

		# case 1: no change, contents match perfectly
		if last_fragment_content == fragment_content:
			# fragment did not change at all
			candidate = (False, False, False, last_fragment)
			break

		# case 2: only name was changed
		last_fragment_content.replace(last_fragment['name'], fragment['name'])
		if last_fragment['name'] != fragment['name'] and last_fragment_content == fragment_content:
			# fragment was renamed but content did not change
			candidate = (False, False, True, last_fragment)	
			break

		# case 3: content was changed by means of renaming other fragments
		for fragment_name in fragment_names:
			last_fragment_content = last_fragment_content.replace(fragment_name, "_")
			fragment_content = fragment_content.replace(fragment_name, "_")
		last_fragment_content = ''.join(last_fragment_content.split())
		fragment_content = ''.join(fragment_content.split())
		if last_fragment_content == fragment_content and new_fragment_names.count(last_fragment['name']) == 0:
			# fragment was renamed and content changed
			candidate = (False, True, fragment['name'] != last_fragment['name'], last_fragment)

		# case 4: only content was changed
		if last_fragment['name'] == fragment['name'] and new_fragment_names.count(fragment['name']) == 1:
			# fragment was not renamed but content was changed
			candidate = (False, True, False, last_fragment)

	if candidate:
		return candidate

	return (True, False, False, None)

# check all snapshots at a commit
def from_commit(commit, last_fragments, rp, variation_dirs, num_parents, db, repo):
	global tracks, refs
	print '> ' + commit.hexsha + " (" + str(num_parents) + " parents)"
	print '> ' + commit.message
	# extract snapshots
	fragments = list(db.fragmentSnapshots.find({'sha': commit.hexsha}))
	variation_dir = find_variation_dir(rp, variation_dirs)
	# extract all file moves
	if len(commit.parents) > 0:
		diff_index = commit.parents[0].diff(other=commit, create_patch=True)
		rename_diffs = list(diff_index.iter_change_type('R'))
		moves = [(os.path.relpath(diff.rename_from, variation_dir), os.path.relpath(diff.rename_to, variation_dir)) for diff in rename_diffs if diff is not None]
	else:
		moves = []
		
	# check all snapshots
	for fragment in fragments:
		# get flags and last snapshot
		(fragment['is_new'], fragment['is_changed'], fragment['is_renamed'], old_fragment) = track_fragment_snapshot(fragment, last_fragments, fragments, commit, moves, rp, variation_dirs, repo)
		# extend tracks
		if not fragment['is_new']:
			sys.stdout.write('o')
			old_id = old_fragment['_id']
			while str(old_id) in refs:
				old_id = refs[str(old_id)]
			tracks[str(fragment['_id'])] = tracks[str(old_id)]
			tracks[str(fragment['_id'])].append(str(fragment['_id']))
			refs[str(old_id)] = str(fragment['_id'])
			if str(old_id) in tracks:
				del tracks[str(old_id)]
		else:
			sys.stdout.write('n')
			sys.stdout.write(fragment['variant'] + fragment['relative_path'] + fragment['name'])
			tracks[str(fragment['_id'])] = [str(fragment['_id'])]
		sys.stdout.flush() 
		db.fragmentSnapshots.save(fragment)

	last_fragment_ids = tracks.keys()
	print len(tracks)

	return fragments

def extract_new(rp, variation_dirs, repo, db, commits, dirty=False):
	global tracks
	print 'Extracting from ' + str(len(commits)) +' commits.'

	for track in db.fragmentTracks.find({'repo_path': rp}):
		tracks[str(track['last_snapshot_fragment_id'])] = map(str, track['fragment_snapshot_ids'])

	first_new_commit = commits[0]

	last_fragmentss = {}
	for parent in first_new_commit.parents:
		last_fragmentss[parent.hexsha] = list(db.fragmentSnapshots.find({'repo_path': rp, 'sha': parent.hexsha}))	

	extract(rp, variation_dirs, repo, db, commits, last_fragmentss, dirty=dirty)


def extract(rp, variation_dirs, repo, db, commits, last_fragmentss=None, dirty=False):
		
	# extract variants from each commit
	print 'Extracting from ' + str(len(commits)) +' commits.'

	last_fragmentss = last_fragmentss or {}

	for idx, commit in enumerate(commits):
			last_fragments = []
			num_parents = len(commit.parents)
			for parent in commit.parents:
				if parent.hexsha in last_fragmentss:
					last_fragments.extend(last_fragmentss[parent.hexsha])
			last_fragmentss[commit.hexsha] = from_commit(commit, last_fragments, rp, variation_dirs, num_parents, db, repo)

	# save tracks as actual fragments
	for last_in_track in tracks:

		existing = list(db.fragmentTracks.find({'first_snapshot_fragment_id': ObjectId(tracks[last_in_track][0])}))

		if len(existing) != 0:
			document = existing[0]
		else:
			document = {}

		document['repo_path'] = rp

		is_dirty = dirty
		if dirty:
			last_fragment = list(db.fragmentSnapshots.find({'_id': ObjectId(last_in_track)}))[0]
			if last_fragment['sha'] == commits[-1].hexsha:
				document['last_snapshot_fragment_id'] = ObjectId(tracks[last_in_track][-2])
				document['fragment_snapshot_ids'] = map(ObjectId, tracks[last_in_track][:-1])
				document['first_snapshot_fragment_id'] = ObjectId(tracks[last_in_track][0])
				document['dirty_last_snapshot_fragment_id'] = ObjectId(last_in_track)
				document['dirty'] = True
			else:
				is_dirty = False

		if not is_dirty:
			document['last_snapshot_fragment_id'] = ObjectId(last_in_track)
			document['fragment_snapshot_ids'] = map(ObjectId, tracks[last_in_track])
			document['first_snapshot_fragment_id'] = ObjectId(tracks[last_in_track][0])
		db.fragmentTracks.save(document)
