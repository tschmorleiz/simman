#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from git import *
import os.path
from pymongo import MongoClient

import action_extractor
import variant_extractor
import fragment_snapshots_extractor
import fragment_tracks_extractor
import similarity_snapshots_extractor
import similarity_evolutions_extractor
import variants_distances_extractor
import tree_extractor

def extract_all(rp):

	# create repo object
	repo = Repo(rp)

	# connect to ann DB
	client = MongoClient()
	db = client.anntest_pp

	db_repo = list(db.repos.find({'path': rp}))[0]
	variation_dirs = db_repo['settings']['variationDirs']
	tp = db_repo['settings']['tp']
	st = db_repo['settings']['st']
	if 'lt' in db_repo['settings']:
		lt = db_repo['settings']['lt']
	else:
		lt = 0

	commits = list(repo.iter_commits('master'))
	commits.reverse()
	if len(commits) == 0:
		exit(0)

	last_hexsha = commits[-1].hexsha
	db_repo['last_hexsha_checked'] = last_hexsha
	db.repos.save(db_repo)

	# extract actions
	print 'Extracting actions'
	action_extractor.extract(rp, variation_dirs, repo, db, commits)

	# extract variants
	print 'Extracting variants...'
	variant_extractor.extract(rp, variation_dirs, repo, db, commits)

	# extract fragment snapshots
	print 'Extracting fragment snapshots...'
	fragment_snapshots_extractor.extract(rp, tp, lt, variation_dirs, repo, db, commits)

	# extract fragment tracks
	print 'Extracting fragment tracks'
	fragment_tracks_extractor.extract(rp, variation_dirs, repo, db, commits)

	# extract similarity snapshots
	print 'Extracting similarity snapshots'
	similarity_snapshots_extractor.extract(rp, st, tp, variation_dirs, repo, db, commits)

	# extract similarity evolutions
	print 'Extracting similarity evolutions'
	similarity_evolutions_extractor.extract(rp, repo, db, commits)

	# extract variants distances graph
	print 'Extracting distances of variants'
	variants_distances_extractor.extract(rp, db, commits[-1])

	# extract variant trees
	print 'Extract file trees of variants '
	tree_extractor.extract(rp, variation_dirs, repo, db, commits[-1])

if __name__ == '__main__':
	# parse arguments
	parser = argparse.ArgumentParser(description='Extract a repo script from a repository')
	parser.add_argument('rp', type=str, help='Path to the repository')
	parser.set_defaults(with_db=True)
	args = vars(parser.parse_args())
	rp = args['rp']

	extract_all(rp)

