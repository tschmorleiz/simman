#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from git import *
import os.path
from pymongo import MongoClient
import itertools

import action_extractor
import variant_extractor
import fragment_snapshots_extractor
import fragment_tracks_extractor
import similarity_snapshots_extractor
import similarity_evolutions_extractor
import variants_distances_extractor
import tree_extractor

def extract_new(rp):
	# create repo object
	repo = Repo(rp)

	# connect to ann DB
	client = MongoClient()
	db = client.anntest_pp

	db_repo = list(db.repos.find({'path': rp}))
	if len(db_repo) > 0:
		db_repo = db_repo[0]
	else:
		print 'Repository was not yet analyzed, use all_extractor.py.'
		exit(0)

	variation_dirs = db_repo['settings']['variationDirs']
	db_repo['settings']['tp'] = "/Users/tschmorleiz/Projects/101/101repo" 
	tp = db_repo['settings']['tp']
	st = db_repo['settings']['st']
	if 'lt' in db_repo['settings']:
		lt = db_repo['settings']['lt']
	else:
		lt = 0

	commits = list(repo.iter_commits('master'))
	commits.reverse()

	if len(commits) == 0:
		print 'No commits, come back later.'
		exit(0)

	if 'last_hexsha_checked' not in db_repo:
		print 'Repository was not yet analyzed, use all_extractor.py.'
		exit(0)

	new_commits = list(itertools.dropwhile(lambda c: c.hexsha != db_repo['last_hexsha_checked'], commits))[1:]

	if len(new_commits) == 0:
		print 'Metadata is up-to-date, nothing to do.'
		exit(0)

	# # extract actions
	# print 'Extracting actions'
	# action_extractor.extract_new(rp, variation_dirs, repo, db, new_commits)

	# # extract variants
	# print 'Extracting variants...'
	# variant_extractor.extract_new(rp, variation_dirs, repo, db, new_commits)

	# # extract fragment snapshots
	# print 'Extracting fragment snapshots...'
	# fragment_snapshots_extractor.extract_new(rp, tp, lt, variation_dirs, repo, db, new_commits)

	# # extract fragment tracks
	# print 'Extracting fragment tracks'
	# fragment_tracks_extractor.extract_new(rp, variation_dirs, repo, db, new_commits)

	# extract similarity snapshots
	print 'Extracting similarity snapshots'
	similarity_snapshots_extractor.extract_new(rp, st, tp, variation_dirs, repo, db, new_commits)

	# extract similarity evolutions
	print 'Extracting similarity evolutions'
	similarity_evolutions_extractor.extract_new(rp, repo, db, new_commits, commits)

	# extract variants distances graph
	print 'Extracting distances of variants'
	variants_distances_extractor.extract(rp, db, commits[-1])

	# extract variant trees
	print 'Extract file trees of variants '
	tree_extractor.extract(rp, variation_dirs, repo, db, commits[-1])

	last_hexsha = new_commits[-1].hexsha
	db_repo['last_hexsha_checked'] = last_hexsha
	db.repos.save(db_repo)

if __name__ == '__main__':
	# parse arguments
	parser = argparse.ArgumentParser(description='Extract a repo script from a repository')
	parser.add_argument('rp', type=str, help='Path to the repository')
	parser.set_defaults(with_db=True)
	args = vars(parser.parse_args())
	rp = args['rp']

	extract_new(rp)
