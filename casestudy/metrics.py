#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from git import *
from subprocess import *
import os.path
from pymongo import MongoClient
from findtools.find_files import (find_files, Match)
from bson import ObjectId
import difflib
import requests
import numpy
import numpy as np
from matplotlib import pyplot as plt


def build_lookup(rp, fragment_tracks):

	track_lookup = {}
	for index_i, track in enumerate(fragment_tracks):
		for index_j, fragment_id in enumerate(track['fragment_snapshot_ids']):
			track_lookup[fragment_id] = (index_i,index_j)

	return track_lookup

parser = argparse.ArgumentParser(description='Extract fragments from repository')
parser.add_argument('rn', type=str, help='Name of the repository')	
parser.add_argument('rp', type=str, help='Path to the repository')
parser.add_argument('dbn', type=str, help='Name to the database')
args = vars(parser.parse_args())
rn = args['rn']
rp = args['rp']
dbn = args['dbn']

repo = Repo(rp)

# connect to ann DB
client = MongoClient()
db = client[dbn]
last_hexsha = list(db.repos.find({'path' : rp}))[0]['last_hexsha_checked']
data = []

sccs = requests.get('http://localhost:3000/api/similarities/sccs/' + rn).json()


############ SIMILARITIES ############

diff_ratios = []
for similaritySnapshot in db.similaritySnapshots.find({'sha': last_hexsha}):
	diff_ratios.append(similaritySnapshot['diff_ratio'])

print 'Similarities'
print '* median:', numpy.median(numpy.array(diff_ratios))
print '* average:', numpy.average(numpy.array(diff_ratios))


############ EQUALITY CLASSES ############
print
print '---------'
print

print 'Equality classes'
print '* total:', len(sccs) 
print '* max:', max(map(len, sccs))
print '* median:', numpy.median(numpy.array(map(len, sccs)))
print '* average:', numpy.average(numpy.array(map(len, sccs)))



############ FRAGMENTS ############

fragment_tracks = list(db.fragmentTracks.find({"repo_path": rp}))
track_lookup = build_lookup(rp, fragment_tracks)

tc = 0
c = 0

for fragment in db.fragmentSnapshots.find({'sha': last_hexsha}):
	tc += 1

	inscc = False

	for ssc in sccs:
		if str(fragment['_id']) in ssc:
			inscc = True

	if not inscc:
		c += 1

print
print '---------'
print
print 'Fragments'
print '* total:', tc
print '* unique:', len(sccs) + c
print '* shared:', tc - c
print '* non-shared:', c
print '* median number of variant a fragment is shared in:', numpy.median(numpy.array([1] * c + map(len, sccs)))
print '* median number of variant a fragment is shared in:', numpy.average(numpy.array([1] * c + map(len, sccs)))

############ SIMILARITY EVOLUTIONS TOTAL ############
a_e = 0
c_e = 0
d_e = 0
a_s = 0

for evolution in db.similarityEvolutions.find({'repo_path': rp}):
	if evolution['min_diff_ratio'] == 1.0 and evolution['max_diff_ratio'] == 1.0:
		a_e += 1
	elif evolution['min_diff_ratio'] < 1.0 and evolution['last_diff_ratio'] == 1.0:
		c_e += 1
	elif evolution['max_diff_ratio'] == 1.0 and evolution['last_diff_ratio'] < 1.0:
		d_e += 1
	else:
		a_s += 1

print
print '---------'
print
print 'Similarity Evolutions (total)'
print '* total', a_e + c_e + d_e + a_s
print '* always equal:', a_e
print '* converge to equal:', c_e
print '* diverge from equal:', d_e
print '* always similar:', a_s

# ############ SIMILARITY EVOLUTIONS UNIQUE ############
# a_e_conns = []
# c_e_conns = []
# d_e_conns = []
# a_s_conns = []

# for evolution in db.similarityEvolutions.find({'repo_path': rp}):
# 	conns = None
# 	if evolution['min_diff_ratio'] == 1.0 and evolution['max_diff_ratio'] == 1:
# 		conns = a_e_conns
# 	elif evolution['min_diff_ratio'] < 1.0 and evolution['last_diff_ratio'] == 1:
# 		conns = c_e_conns
# 	elif evolution['max_diff_ratio'] == 1.0 and evolution['last_diff_ratio'] < 1:
# 		conns = d_e_conns
# 	elif evolution['max_diff_ratio'] < 1.0 and evolution['last_diff_ratio'] < 1:
# 		conns = a_s_conns

# 	source_id = str(evolution['last_source_id'])
# 	target_id = str(evolution['last_target_id'])

# 	for i, scc in enumerate(sccs):
# 		if source_id in scc:
# 			source_id = str(i)
# 		if target_id in scc:
# 			target_id = str(i)

# 	if target_id < source_id:
# 		r = target_id
# 		target_id = source_id
# 		source_id = r

# 	conns.append(source_id + "$$" +  target_id)

# print
# print '---------'
# print 'Similarity Evolutions (unique)'
# print '* total:', len(list(set(a_e_conns))) + len(list(set(c_e_conns))) + len(list(set(d_e_conns))) + len(list(set(a_s_conns)))
# print '* always equal:', len(list(set(a_e_conns)))
# print '* converge to equal:',len(list(set(c_e_conns)))
# print '* diverge from equal:', len(list(set(d_e_conns)))
# print '* always similar:', len(list(set(a_s_conns)))
# print '---------'

############ VARIANTS ############

tc = {}
c = {}

for fragment in db.fragmentSnapshots.find({'sha': last_hexsha}):
	if fragment['variant'] not in tc:
		tc[fragment['variant']] = 0
		c[fragment['variant']] = 0
	
	tc[fragment['variant']] += 1

	inscc = False

	for ssc in sccs:
		if str(fragment['_id']) in ssc:
			inscc = True

	if not inscc:
		c[fragment['variant']] += 1


uniquenesses = {}
for v in tc:
	uniquenesses[v] = float(c[v]) / tc[v] * 100

uniquenesses = sorted(uniquenesses.items(), key=operator.itemgetter(1), reverse=True)


print
print '---------'
print
print 'Variant'
print '* uniquenesses (total fragments, unique fragments, uniqueness)'
for (v, uv) in uniquenesses:
	print ' *', v, ':', tc[v], ',', c[v], ',', uv
print '* median:', numpy.median(numpy.array(map(operator.itemgetter(1), uniquenesses)))
print '* average:', numpy.average(numpy.array(map(operator.itemgetter(1), uniquenesses)))


lengths = map(lambda x: [len(x) - 1] * (len(x)), sccs)

lengths = [x for sub in lengths for x in sub]

OX = range(1, max(list(set(lengths))))
OY = map(lambda r: lengths.count(r), OX)

fig = plt.figure()

width = .35
ind = np.arange(len(OY))
plt.bar(ind, OY)
plt.xticks(ind + width / 2, OX)

fig.autofmt_xdate()


#print OY
print '* median sharing of shared fragments:', numpy.median(numpy.array(lengths))
print '* average sharing of shared fragments:', numpy.average(numpy.array(lengths))
