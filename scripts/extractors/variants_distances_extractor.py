#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from subprocess import *
from git import *
import os.path
from pymongo import MongoClient
from bson.objectid import ObjectId
from findtools.find_files import (find_files, Match)
import difflib


def extract(rp, db, commit):
	
	results = {}
	variants = []
	graph = {
		'nodes': [],
		'links': []
	}

	for similarity in db.similaritySnapshots.find({'repo_path': rp, 'sha': commit.hexsha}):
		v1 = similarity['source_variant']
		v2 = similarity['target_variant']
		if v1 not in variants:
			variants.append(v1)
			graph['nodes'].append({
				'name'  : v1,
				'group' : 1
			})
		if v2 not in variants:
			variants.append(v2)
			graph['nodes'].append({
				'name'  : v2,
				'group' : 1
			})
		if v1 > v2:
			v1, v2 = v2, v1

		if v1 not in results:
			results[v1] = {}

		if v2 not in results[v1]:
			results[v1][v2] = []

		results[v1][v2].append(similarity['diff_ratio'])


	fragment_num_cache = {}

	for v1 in results:
		if v1 not in fragment_num_cache:
			fragment_num_cache[v1] = len(list(db.fragmentSnapshots.find({'repo_path': rp, 'sha': commit.hexsha, 'variant': v1})))
		fragment_num_v1 = fragment_num_cache[v1]
		for v2 in results[v1]:
			if v2 not in fragment_num_cache:
				fragment_num_cache[v2] = len(list(db.fragmentSnapshots.find({'repo_path': rp, 'sha': commit.hexsha, 'variant': v2})))
			fragment_num_v2 = fragment_num_cache[v2]

			distance = sum(results[v1][v2]) / (fragment_num_v1 + fragment_num_v2)
 			graph['links'].append({
 				'source': variants.index(v1),
				'target': variants.index(v2),
				'value': distance,
				'real_value': distance
			})
	db.variantGraphs.remove({'repo_path': rp})
	db.variantGraphs.save({'repo_path': rp, 'graph': graph})