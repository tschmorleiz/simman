import argparse
from git import *
import os.path
from pymongo import MongoClient

from extractors.all_extractor import extract_all

def initialize(rp):

	# create repo object
	repo = Repo(rp)

	# connect to ann DB
	client = MongoClient()
	db = client.anntest_pp

	if len(list(db.repos.find({'path': rp}))) > 0:
		print 'This repository is already configured.'
		return

	print 'Welcome to Ann!'
	print 
	print 'This script will set up this repository for the usage of Ann.'
	print 'For that, we have some questions for the configuration.'
	print 'All settings can letter be changed via the web front-end.'
	print
	print '1/4 Where are the locator/extractor technologies located (please specify an absolute path)?'
	tp = None
	while tp is None:
		tp = raw_input()
		if not os.path.exists(tp):
			print 'Directory not found.'
			tp = None
	print
	print '2/4 What are the names of the directories that hold the variants (separate by comma, specify in order of priority)'
	variation_dirs = None
	while variation_dirs is None:
		variation_dirs = map(lambda x: x.strip(), raw_input().split(','))
	print
	print '3/4 What should the threshold for similarity extraction be (value in [0..1], 0.8 is a reasonable one)?'
	st = None
	while st is None:
		st = raw_input()
		try:
			st = float(st)
		except:
			print 'Not a number'
			st = None
			continue
		if st < 0 or st > 1:
			print 'Not between 0 and 1'
			st = None

	print
	print '4/4 How many lines does a fragment have to have to be extracted (enter 0 to extract all fragments)'
	lt = None
	while lt is None:
		lt = raw_input()
		try:
			lt = int(lt)
		except:
			print 'Not a number'
			lt = None
			continue

	document = {
		'path': rp,
		'settings': {
			'tp': tp,
			'st': st,
			'variationDirs': variation_dirs,
			'lt': lt
		},
		
	}
	db.repos.insert(document)
	print 'Hit enter to start initial extraction...'
	raw_input()
	extract_all(rp)

