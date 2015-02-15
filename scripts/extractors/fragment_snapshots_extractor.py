#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from subprocess import *
from git import *
import os.path
from pymongo import MongoClient
from findtools.find_files import (find_files, Match)

# cache for fragment snapshots
cache = {}

# find the current variation directory
def find_variation_dir(rp, variation_dirs):
	for candidate in variation_dirs:
		full_candidate = os.path.join(rp, candidate)
		if os.path.isdir(full_candidate):
			return candidate
	return None

def extract_new(rp, tp, lt, variation_dirs, repo, db, commits, dirty=False):
	global cache

	# build up cache
	first_new_commit = commits[0]
	hashes = {}
	for parent in first_new_commit.parents:
		repo.git.checkout(parent.hexsha)
		variation_dir = find_variation_dir(rp, variation_dirs)
		full_variation_dir = os.path.join(rp, variation_dir)
		fragments = list(db.fragmentSnapshots.find({'repo_path': rp, 'sha': parent.hexsha}))
		for fragment in fragments:
			full_path = os.path.join(full_variation_dir, fragment['variant'], fragment['relative_path'])
			if full_path not in hashes:
				hashed = hash(open(full_path).read())
				hashes[full_path] = hashed
				cache[hashed] = []
			cache[hashes[full_path]].append(fragment)

	extract(rp, tp, lt, variation_dirs, repo, db, commits, dirty=dirty, clear=False)

def extract(rp, tp, lt, variation_dirs, repo, db, commits, dirty=False, clear=True):

	# load config with tech paths
	config = json.load(open(os.path.dirname(os.path.realpath(__file__)) + '/../config.json'))['fragments-tech']

	# get all fragment snapshots in a source file
	def get_fragment_snapshots(abs_path, rel_path, runner, extractor_path, classifier_blacklist):
		extractor_path = os.path.join(tp, extractor_path)
		myinput = open(abs_path)
		if runner:
			process_args = [runner, extractor_path]
		else:
			process_args = [extractor_path]

		result = Popen(process_args, stdin=myinput, stdout=PIPE).communicate()[0]
		try:
			result = json.loads(result)
		except ValueError, e:
			print result
			print abs_path
			return {'error' : result}	
			
		def collect_fragments(level):
			if 'fragments' not in level:
				return []
			else:
				fs = []
				for f in level['fragments']:
					if f['classifier'] not in classifier_blacklist:
						f_doc = {
							'classifier': f['classifier'],
							'name': f['name']
						}
						if 'startLine' in f:
							f_doc['from'] = f['startLine']
							f_doc['to'] = f['endLine']
						fs.append(f_doc)
					fs.extend(collect_fragments(f))
				return fs

		return {'fragments': collect_fragments(result)}


	# get line range of a fragment snapshot
	def get_line_range(abs_path, rel_path, fragment_snapshot, runner, locator_path):
		locator_path = os.path.join(tp, locator_path)
		fragment_snapshot_path = fragment_snapshot['classifier'] + '/' + fragment_snapshot['name']
		myinput = open(abs_path)
		result = Popen([runner, locator_path, fragment_snapshot_path], stdin=myinput, stdout=PIPE).communicate()[0]
		try:
			return json.loads(result)
		except ValueError, e:
			return {'error' : result}	
		
	# extract all fragment snapshots at commit
	def from_commit(commit, variation_dirs, variations, db):
		global cache
		result = []
		print'> ' + commit.hexsha
		# first, checkout the commit
		repo.git.checkout(commit.hexsha)
		# find the current variation directory
		variation_dir = find_variation_dir(rp, variation_dirs)
		full_variation_dir = os.path.join(rp, variation_dir)
		# extract for all current variations
		for variation in variations:
			full_current_variation_dir = os.path.join(full_variation_dir, variation)
			# extract for all known extensions
			for extension in config:
				# find all files with the current extension
				found_files = list(find_files(path=full_current_variation_dir, match=Match(filetype='f', name='*.' + extension)))
				print' > ' + variation
				# extract for all found files
				for found_file in found_files:
					rel_path = os.path.relpath(found_file, full_current_variation_dir)
					hashed = hash(open(found_file).read())
					# check if cached
					if hashed in cache:
						fragment_snapshots = cache[hashed]
						if fragment_snapshots == "error":
							continue
					# else extract
					else:
						fragment_snapshots = get_fragment_snapshots(found_file, rel_path, config[extension]['runner'], config[extension]['extractor'], config[extension]['classifier_blacklist'])
						if'error' in fragment_snapshots:
							print 'error'
							cache[hashed] = "error"
							continue
						fragment_snapshots = fragment_snapshots['fragments']
						for idx, fragment_snapshot in enumerate(fragment_snapshots):
							# extract line range and enrich fragment snapshot
							if 'from' in fragment_snapshots[idx]:
								line_range = {
									'from': fragment_snapshots[idx]['from'],
									'to': fragment_snapshots[idx]['to']
								}
							else:
								line_range = get_line_range(found_file, rel_path, fragment_snapshot, config[extension]['runner'], config[extension]['locator'])
							if not'error' in line_range:
								print "####"
								print line_range['to'] - line_range['from'] + 1
								print lt
								print "####"
								if (line_range['to'] - line_range['from'] + 1) < lt:
									continue
								fragment_snapshots[idx]['language'] = config[extension]['language']
								fragment_snapshots[idx]['from'] = line_range['from']
								fragment_snapshots[idx]['to'] = line_range['to']
								fragment_snapshots[idx]['repo_path'] = rp
							# store in cache
							cache[hashed] = fragment_snapshots
				    # save document for each fragment snapshot
					for idx, fragment_snapshot in enumerate(fragment_snapshots):
						fragment_snapshots[idx]['variant'] = variation
						fragment_snapshots[idx]['relative_path'] = rel_path
						fragment_snapshots[idx]['sha'] = commit.hexsha
						if '_id' in fragment_snapshots[idx]:
							del fragment_snapshots[idx]['_id']
						if dirty:
							fragment_snapshots[idx]['dirty'] = True
						db.fragmentSnapshots.insert(fragment_snapshots[idx])


	print 'Extracting from ' + str(len(commits)) +' commits.'

	# lookup variations directories and variations
	repo_data = db.repos.find({'path': rp})[0]
	all_variations = repo_data['variants']

	# extract fragment snapshots from each commit
	fragments = []
	if clear:
		db.fragmentSnapshots.remove({'repo_path': rp})
	for idx, commit in enumerate(commits):
		from_commit(commit, variation_dirs, all_variations[commit.hexsha], db)
    	