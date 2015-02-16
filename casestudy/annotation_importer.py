#! /usr/bin/env python
import sys
import os
import argparse
import json
from git import *
from pymongo import MongoClient

parser = argparse.ArgumentParser(description='Export annotations from dump file')
parser.add_argument('dbn', type=str, help='Name of the database')
parser.add_argument('dp', type=str, help='Path to the annotation dump')
parser.add_argument('rp', type=str, help='Path of the repository')
args = vars(parser.parse_args())

dbn = args['dbn']
dp = args['dp']
rp = args['rp']

repo = Repo(rp)
last_hexsha = list(repo.iter_commits('master'))[0].hexsha

# connect to ann DB
client = MongoClient()
db = client[dbn]

dirname, filename = os.path.split(os.path.abspath(__file__))
dumped_annotations = json.load(open(os.path.join(dirname, dp)))

for i, dumped_annotation in enumerate(dumped_annotations):
	print i + 1, '/', len(dumped_annotations)
	source_fragment = dumped_annotation['source_fragment']
	source_fragment['sha'] = last_hexsha
	target_fragment = dumped_annotation['target_fragment']
	target_fragment['sha'] = last_hexsha
	source_fragment = list(db.fragmentSnapshots.find(source_fragment))
	target_fragment = list(db.fragmentSnapshots.find(target_fragment))
	if len(source_fragment) != 1 or len(target_fragment) != 1:
		continue
	
	similarityEvolution = list(db.similarityEvolutions.find({
		'last_target_id': source_fragment[0]['_id'],
		'last_source_id': target_fragment[0]['_id']
	}))

	if len(similarityEvolution) != 1:
		continue

	similarityEvolution = similarityEvolution[0]

	annotations = list(db.annotations.find({'annotated_evolution_id': similarityEvolution['_id']}))

	db.annotations.remove(annotations)

	new_annotation = {
		'name' : dumped_annotation['name'],
		'intent': dumped_annotation['intent'],
		'annotated_evolution_id': similarityEvolution['_id']
	}
	if 'propagate_to' in dumped_annotation:
		new_annotation['propagate_to'] = dumped_annotation['propagate_to']

	db.annotations.insert(new_annotation)


	

