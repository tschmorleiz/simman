#! /usr/bin/env python
import argparse
from git import *
from pymongo import MongoClient
from bson.objectid import ObjectId


def build_lookup(rp, fragment_tracks):

	track_lookup = {}
	for index_i, track in enumerate(fragment_tracks):
		for index_j, fragment_id in enumerate(track['fragment_snapshot_ids']):
			track_lookup[fragment_id] = (index_i,index_j)

	return track_lookup

def extract_new(rp, repo, db, new_commits, all_commits):

	extract(rp, repo, db, all_commits)


def extract(rp, repo, db, commits, similarity_tracks_agg={}):

	fragment_tracks = list(db.fragmentTracks.find({"repo_path": rp}))
	track_lookup = build_lookup(rp, fragment_tracks)

	similarity_box = {}
	similarities = db.similaritySnapshots.find({"repo_path": rp})
	for similarity in similarities:
		if similarity['sha'] not in similarity_box:
			similarity_box[similarity['sha']] = []
		similarity_box[similarity['sha']].append(similarity)

	for commit in commits:
		if commit.hexsha not in similarity_box:
			continue
		print commit.hexsha
		similarities = similarity_box[commit.hexsha]
		for similarity in similarities:

			(target_track_index, target_track_inner_index) = track_lookup[similarity['target_id']]
			(source_track_index, source_track_inner_index) = track_lookup[similarity['source_id']]
			key = str(fragment_tracks[source_track_index]['_id']) + ":" + str(fragment_tracks[target_track_index]['_id'])

			if key not in similarity_tracks_agg:
				similarity_tracks_agg[key] = []

			similarity_tracks_agg[key].append(similarity['_id'])

	similarity_tracks = {}

	flipped = {}

	for key in similarity_tracks_agg:
		[a, b] = key.split(":")
		if b + ":" + a in flipped:
			continue
		else:
			flipped[a + ":" + b] = True
			similarity_tracks[key] = similarity_tracks_agg[key]

	print len(similarity_tracks)

	shas = map(lambda c: c.hexsha, commits)

	used_tracks = []

	similaritySnapshots = {}

	for ss in db.similaritySnapshots.find({'repo_path': rp}):
		similaritySnapshots[str(ss['_id'])] = ss

	for i, key in enumerate(similarity_tracks):
		similarity_ids = similarity_tracks[key]
		first_similarity = list(db.similaritySnapshots.find({'_id': similarity_ids[0]}))[0]
		last_similarity = list(db.similaritySnapshots.find({'_id': similarity_ids[-1]}))[0]
		if last_similarity["sha"] != shas[-1]:
			continue
		[source_track_id, target_track_id] = key.split(":")
		used_tracks.append(similarity_ids)

		document = {}
		document['repo_path'] = rp

		document['similarity_ids'] = similarity_ids

		max_diff_ratio = 0.0
		min_diff_ratio = 1.0
		for similarity_id in similarity_ids:
			diff_ratio = similaritySnapshots[str(similarity_id)]['diff_ratio']
			if diff_ratio > max_diff_ratio:
				max_diff_ratio = diff_ratio
			if diff_ratio < min_diff_ratio:
				min_diff_ratio = diff_ratio

		# try to find existing evolution id for this track

		document['source_track_id'] = source_track_id
		document['target_track_id'] = target_track_id

		existing = list(db.similarityEvolutions.find({
			'source_track_id': source_track_id,
			'target_track_id': target_track_id
		}))

		existingFlipped = list(db.similarityEvolutions.find({
			'source_track_id': target_track_id,
			'target_track_id': source_track_id
		}))

		if len(existing) > 0:
			document['_id'] = existing[0]['_id']
		elif len(existingFlipped) > 0:
			document['_id'] = existingFlipped[0]['_id']

		first_source_fragment = db.fragmentSnapshots.find({'_id': first_similarity['source_id']})[0]
		first_target_fragment = db.fragmentSnapshots.find({'_id': first_similarity['target_id']})[0]

		document['first_similarity_id'] = similarity_ids[0]
		document['first_sha'] = first_similarity['sha']
		document['first_source_id'] = first_similarity['source_id']
		document['first_source_variant'] = first_similarity['source_variant']
		document['first_source_relative_path'] = first_source_fragment['relative_path']
		document['first_source_classifier'] = first_source_fragment['classifier']
		document['first_source_name'] = first_source_fragment['name']
		document['first_target_id'] = first_similarity['target_id']
		document['first_target_variant'] = first_similarity['target_variant']
		document['first_target_relative_path'] = first_target_fragment['relative_path']
		document['first_target_classifier'] = first_target_fragment['classifier']
		document['first_target_name'] = first_target_fragment['name']
		document['first_diff_ratio'] = first_similarity['diff_ratio']

		last_source_fragment = db.fragmentSnapshots.find({'_id': last_similarity['source_id']})[0]
		last_target_fragment = db.fragmentSnapshots.find({'_id': last_similarity['target_id']})[0]

		document['last_similarity_id'] = similarity_ids[-1]
		document['last_sha'] = last_similarity['sha']
		document['last_source_id'] = last_similarity['source_id']
		document['last_source_variant'] = last_similarity['source_variant']
		document['last_source_relative_path'] = last_source_fragment['relative_path']
		document['last_source_classifier'] = last_source_fragment['classifier']
		document['last_source_name'] = last_source_fragment['name']
		document['last_target_id'] = last_similarity['target_id']
		document['last_target_variant'] = last_similarity['target_variant']
		document['last_target_relative_path'] = last_target_fragment['relative_path']
		document['last_target_classifier'] = last_target_fragment['classifier']
		document['last_target_name'] = last_target_fragment['name']
		document['last_diff_ratio'] = last_similarity['diff_ratio']

		document['min_diff_ratio'] = min_diff_ratio
		document['max_diff_ratio'] = max_diff_ratio

		db.similarityEvolutions.save(document)

	lengths =  sorted(map(len, used_tracks))
	print lengths
