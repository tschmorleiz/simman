#! /usr/bin/env python
import argparse
import json
import shutil
import operator
from git import *
from subprocess import *
import os.path
from pymongo import MongoClient
from bson import ObjectId
import itertools
import difflib
import tempfile
import merger

import extractors.new_extractor as ne
import extractors.variant_extractor as ve
import extractors.fragment_snapshots_extractor as fse
import extractors.fragment_tracks_extractor as fte

# get all actual automatically executable annotations
def get_annotations(db, last_hexsha):
	equality_annotations = []
	similarity_annotations = []
	for annotation in db.annotations.find():
		# get corresponding evolution
		evolution_id = annotation['annotated_evolution_id']
		evolution = list(db.similarityEvolutions.find({'_id': ObjectId(evolution_id)}))

		if len(evolution) != 0:
			evolution = evolution[0]
		else:
			continue
		# check if evolution goes to HEAD
		if evolution['last_sha'] != last_hexsha:
			continue
		# check annotation name
		annotation_name = annotation['name']	

		if annotation_name in ['maintain-equality', 'restore-equality']:
			equality_annotations.append((annotation, evolution))
		else:
			similarity_annotations.append((annotation, evolution))

	return (equality_annotations, similarity_annotations)

def do_fake_commit(repo):
	repo.git.commit(m='fake')

def undo_fake_commit(repo):
	repo.git.checkout('master')
	repo.head.reset(commit='HEAD~1', index=False)

def create_dirty_fragments(rp, repo, db_repo, db):
	variation_dirs = db_repo['settings']['variationDirs']
	commits = [repo.head.commit]
	ve.extract_new(rp, variation_dirs, repo, db, commits)
	tp = db_repo['settings']['tp']
	fse.extract_new(rp, tp, variation_dirs, repo, db, commits, dirty=True)
	fte.extract_new(rp, variation_dirs, repo, db, commits, dirty=True)

def cleanup_dirty_fragments(db, repo):
	db.fragmentSnapshots.remove({'dirty': True})
	for track in db.fragmentTracks.find({'dirty': True}):
		del track['dirty']
		del track['dirty_last_snapshot_fragment_id']
		db.fragmentTracks.save(track)

# find the current variation directory
def find_variation_dir(rp, variation_dirs):
	for candidate in variation_dirs:
		full_candidate = os.path.join(rp, candidate)
		if os.path.isdir(full_candidate):
			return candidate
	return None

current_checkout_sha = None

def checkout_at_fragment(fragment, repo):
	if fragment.get('dirty'):
		repo.git.checkout('master')
	else:
		repo.git.checkout(fragment['sha'])

# dictionary for changes line ranges due to propagation
ranges = {}

def get_fragment_line_range(fragment):
	global ranges
	if fragment['_id'] in ranges:
		return ranges[fragment['_id']]
	else:
		return fragment['from'], fragment['to']

content_cache = {}

# get content of a fragment snapshot
def get_fragment_content(fragment, rp, variation_dirs, repo):
	global ranges, content_cache
	if fragment['_id'] in content_cache:
		return content_cache[fragment['_id']]
	if not fragment.get('dirty'):
		repo.git.checkout('master')
		stash_changes(repo)
	checkout_at_fragment(fragment, repo)
	variation_dir = find_variation_dir(rp, variation_dirs)
	path = os.path.join(rp, variation_dir, fragment['variant'], fragment['relative_path'])
	with open(path) as f:
		f_from, f_to = get_fragment_line_range(fragment)
		content = ''.join(f.readlines()[(f_from - 1):f_to])
		if not fragment.get('dirty'):
			repo.git.checkout('master')
			unstash_changes(repo)
		content_cache[fragment['_id']] = content
		return content

config = None
content_lines_cache = {}

def get_fragment_content_lines(fragment, content, db_repo):
	global config, content_lines_cache
	if fragment['_id'] in content_lines_cache:
		return content_lines_cache[fragment['_id']]
	if not config:
		config = json.load(open(os.path.dirname(os.path.realpath(__file__)) + '/../config.json'))['fragments-tech']
	extension = os.path.splitext(fragment['relative_path'])[1][1:]
	if extension in config and 'line-pp' in config[extension]:
		temp_f = tempfile.NamedTemporaryFile(delete=False)
		temp_f.write(content)
		temp_f.close()
		line_pp_path = os.path.join(db_repo['settings']['tp'], config[extension]['line-pp'])
		result = Popen([config[extension]['runner'], line_pp_path], stdin=open(temp_f.name), stdout=PIPE).communicate()[0]
		content_lines_cache[fragment['_id']] = result
		return result

def set_fragment_content(fragment, rp, variation_dirs, repo, new_fragment_content, db):
	global ranges, content_cache
	print 'Propagating changes to ' + get_path(fragment)
	if not fragment.get('dirty'):
		repo.git.checkout('master')
		stash_changes(repo)
	checkout_at_fragment(fragment, repo)
	variation_dir = find_variation_dir(rp, variation_dirs)
	path = os.path.join(rp, variation_dir, get_path(fragment, with_fragment=False))
	if not fragment.get('dirty'):
		repo.git.checkout('master')
		unstash_changes(repo)
	new_lines = new_fragment_content.splitlines(True)

	new_content = ''
	with open(path, 'r') as f:
		lines = f.readlines()
		f_from, f_to = get_fragment_line_range(fragment)
		before_fragment_lines = lines[:max(0, f_from - 1)]
		after_fragment_lines = lines[f_to:]
		new_content = ''.join(before_fragment_lines + new_lines + after_fragment_lines)

	with open(path, 'w') as f:
		del content_lines_cache[fragment['_id']]
		content_cache[fragment['_id']] = new_content
		f.write(new_content)
		f.flush()

	# adjust line ranges for given fragment
	new_f_from = f_from
	new_f_to = new_f_from + (len(new_lines) - 1)
	ranges[fragment['_id']] = (new_f_from, new_f_to)

	# adjust line ranges for other fragments in file
	others = db.fragmentSnapshots.find({
		'dirty'         : True,
		'variant'       : fragment['variant'],
		'relative_path' : fragment['relative_path']
	})
	move = new_f_to - f_to
	for other in others:
		if str(other['_id']) == str(fragment['_id']):
			continue
		if other['from'] > new_f_to:
			old_f_from, old_f_to = other['from'], other['to']
			ranges[other['_id']] = (old_f_from + move, old_f_to + move)


def update_extraction(rp, repo, db_repo, db, commits):
	variation_dirs = db_repo['settings']['variationDirs']
	ne.extract_new(rp)

def stash_changes(repo):
	repo.git.stash()

def unstash_changes(repo):
	try:
		repo.git.stash('apply')
		repo.git.add('.')
	except:
		pass

def get_path(fragment, with_fragment=True):
	components = ['variant', 'relative_path']
	if with_fragment:
		components.extend(['classifier', 'name'])
	return '/'.join(map(lambda x: fragment[x],components))

def main(rp):

	# check status of repo
	repo = Repo(rp)

	# check whether all changes are indexed
	if len(repo.git.diff(None)) != 0:
		print 'Please add all changes to the index'
		exit(0)

    # check for untracked files
	if len(repo.untracked_files) != 0:
		print 'Please track or remove all untracked files'
		exit(0)

	# connect to ann DB and get some data
	client = MongoClient()
	db = client.anntest_pp
	db_repo = list(db.repos.find({'path': rp}))[0]
	variation_dirs = db_repo['settings']['variationDirs']
	last_hexsha_checked = db_repo['last_hexsha_checked']
	# get commits
	commits = list(repo.iter_commits('master'))
	commits.reverse()

	has_stashed = False
	# four options regarding state of repository
	if repo.head.commit.hexsha == last_hexsha_checked:
		# 1. all commits extracted and clean workspace, all good
		if len(repo.index.diff('HEAD')) == 0:
			print 'All commits extracted and clean workspace.'
		# 2. all commits extracted, but indexed changes
		else:
			print 'All commits extracted, but indexed changes.'
			do_fake_commit(repo)
			create_dirty_fragments(rp, repo, db_repo, db)
			undo_fake_commit(repo)
	else:
		# 3. not all commit extracted, but clean workspace
		if len(repo.index.diff('HEAD')) == 0:
			print 'Not all commit extracted, but clean workspace.'
			update_extraction(rp, repo, db_repo, db, commits)
		# 4. not all commits extracted and indexed changes
		else:
			print 'Not all commits extracted and indexed changes'
			has_stashed = True
			stash_changes(repo)
			update_extraction(rp, repo, db_repo, db, commits)
			unstash_changes(repo)
			do_fake_commit(repo)
			create_dirty_fragments(rp, repo, db_repo, db)
			undo_fake_commit(repo)

	repo.git.checkout('master')

	# check all annotations
	ignore = []
	conflicts = []
	recheck = True

	# print 'Loading fragments...'
	# for fragment in db.fragmentSnapshots.find({'sha': last_hexsha_checked}):
	# 	get_fragment_content(fragment, rp, variation_dirs, repo)

	similarity_annotations = []
	while recheck:
		(equality_annotations, similarity_annotations) = get_annotations(db, last_hexsha_checked)
		if len(equality_annotations) == 0:
			recheck = False
		for annotation, evolution in equality_annotations:
			recheck = False


			if annotation['name'] == 'maintain-equality':
				continue
			# check if not to ignore because on previous issues
			if annotation['_id'] in ignore:
				continue

			# lookup both fragments' tracks and latest snapshots
			target_track = list(db.fragmentTracks.find({'_id': ObjectId(evolution['target_track_id'])}))[0]
			source_track = list(db.fragmentTracks.find({'_id': ObjectId(evolution['source_track_id'])}))[0]

			if target_track.get('dirty'):
				target_fragment_id = target_track['dirty_last_snapshot_fragment_id']
			else:
				target_fragment_id = target_track['last_snapshot_fragment_id']

			target_fragment = list(db.fragmentSnapshots.find({'_id': target_fragment_id}))[0]
			target_fragment_content = get_fragment_content(target_fragment, rp, variation_dirs, repo)

			target_fragment_content_lines = get_fragment_content_lines(target_fragment, target_fragment_content, db_repo)

			if source_track.get('dirty'):
				source_fragment_id = source_track['dirty_last_snapshot_fragment_id']
			else:
				source_fragment_id = source_track['last_snapshot_fragment_id']

			source_fragment = list(db.fragmentSnapshots.find({'_id': source_fragment_id}))[0]
			source_fragment_content = get_fragment_content(source_fragment, rp, variation_dirs, repo)

			source_fragment_content_lines = get_fragment_content_lines(source_fragment, source_fragment_content, db_repo)

			print get_path(source_fragment, with_fragment=True) + ' <-> ' + get_path(target_fragment, with_fragment=True)

			# nothing to do if equal, maybe update
			if source_fragment_content_lines == target_fragment_content_lines:
				print '> Equal'
				annotation['auto'] = True
				annotation['name'] = 'maintain-equality'
				db.annotations.save(annotation)
				continue

			if 'propagate_to' in annotation and annotation['propagate_to'] in ['source', 'target']:

				if annotation['propagate_to'] == 'source':
					merge_content = target_fragment_content
				else:
					merge_content = source_fragment_content

			else:

				# find point where fragments where similar
				similarity_ids = evolution['similarity_ids']
				similarity_ids.reverse()
				equal_point = None
				for similarity_id in similarity_ids:
					similarity = list(db.similaritySnapshots.find({'_id': similarity_id}))[0]
					if similarity['diff_ratio'] == 1.0:
						equal_point = similarity

				# no equal point found, should be impossible
				if equal_point is None:
					annotation['auto'] = False
					print "ERROR"
					print annotation, evolution
					raw_input()
					# db.annotation.save(annotation)
					ignore.append(annotation['_id'])
				# get parent with content
				parent_fragment = list(db.fragmentSnapshots.find({'_id': equal_point['source_id']}))[0]
				parent_fragment_content = get_fragment_content(parent_fragment, rp, variation_dirs, repo)

				# attempt merge
				merge = merger.merge(parent_fragment_content, source_fragment_content, target_fragment_content)

				# check for merge conflicts
				if len(merge['conflicts']) != 0 and annotation['_id'] not in conflicts:
					if 'propagate_to' in annotation and annotation['propagate_to'] in ['source', 'target']:

						if annotation['propagate_to'] == 'source':
							merge_content = target_fragment_content
						else:
							merge_content = source_fragment_content

					else:


						# update annotation to manual restore-equality
						print 'Three-way merge failed for:'
						print '- ' + get_path(source_fragment)
						print 'Content:'
						print source_fragment_content
						print '- ' + get_path(target_fragment)
						print 'Content:'
						print target_fragment_content
						print parent_fragment_content
						print 'Original content:'
						print merge



						answer = ''
						while answer not in ['f', 's', 'm']:
							print "Take (f)irst or (s)econd or do (m)anually?"
							answer = raw_input()

						if answer == 'f':
							merge_content = source_fragment_content
						if answer == 's':
							merge_content = target_fragment_content
						else:
							annotation['auto'] = False
							annotation['name'] = 'restore-equality'
							db.annotations.save(annotation)
							conflicts.append(annotation['_id'])
							continue
					
				else:
					merge_content = ''.join(merge['merge'])

			if 'propagate_to' in annotation and annotation['propagate_to'] == 'target':
				print get_path(target_fragment, with_fragment=True)
				set_fragment_content(target_fragment, rp, variation_dirs, repo, merge_content, db)
				del annotation['propagate_to']
				annotation['auto'] = True
				annotation['name'] = 'maintain-equality'
				db.annotations.save(annotation)
				recheck = True
			elif 'propagate_to' in annotation and annotation['propagate_to'] == 'source':
				print get_path(source_fragment, with_fragment=True)
				set_fragment_content(source_fragment, rp, variation_dirs, repo, merge_content, db)
				del annotation['propagate_to']
				annotation['auto'] = True
				annotation['name'] = 'maintain-equality'
				db.annotations.save(annotation)
				recheck = True
			elif merge_content == source_fragment_content:
				print get_path(target_fragment, with_fragment=True)
				set_fragment_content(target_fragment, rp, variation_dirs, repo, merge_content, db)
				annotation['auto'] = True
				annotation['name'] = 'maintain-equality'
				db.annotations.save(annotation)
				recheck = True
			elif merge_content == target_fragment_content:
				print get_path(source_fragment, with_fragment=True)
				set_fragment_content(source_fragment, rp, variation_dirs, repo, merge_content, db)
				annotation['auto'] = True
				annotation['name'] = 'maintain-equality'
				db.annotations.save(annotation)
				recheck = True
			else:
				print 'Need to merge and change both of:'
				print source_fragment_content
				print '- ' + get_path(source_fragment)
				print target_fragment_content
				print '- ' + get_path(target_fragment)
				print 'New content would be:'
				print merge_content
				answer = ''
				if annotation['intent']:
					print 'Intent of annotation: ' + annotation['intent']
				while answer not in ['y', 'n']:
					print 'Should both be changed (y/n)?'
					answer = raw_input()
				if answer == 'y':
					set_fragment_content(target_fragment, rp, variation_dirs, repo, merge_content, db)
					set_fragment_content(source_fragment, rp, variation_dirs, repo, merge_content, db)
					recheck = True
				else:
					annotation['auto'] = False
					annotation['name'] = 'restore-equality'
					db.annotations.save(annotation)


		repo.git.add('.')						
		repo.git.checkout('master')
		exit(0)

	exit(0)
	for (annotation, evolution) in similarity_annotations:


		if evolution['last_diff_ratio'] == 1:
			annotation['name'] = 'maintain-equality'
			annotation['auto_updated'] = True
			db.annotations.save(annotation)
			continue

		# lookup both fragments' tracks and latest snapshots
		target_track = list(db.fragmentTracks.find({'_id': ObjectId(evolution['target_track_id'])}))[0]
		source_track = list(db.fragmentTracks.find({'_id': ObjectId(evolution['source_track_id'])}))[0]

		if target_track.get('dirty'):
			print "X", target_track['dirty_last_snapshot_fragment_id']
			target_fragment_id = target_track['dirty_last_snapshot_fragment_id']
		else:
			target_fragment_id = target_track['last_snapshot_fragment_id']

		target_fragment = list(db.fragmentSnapshots.find({'_id': target_fragment_id}))[0]
		target_fragment_content = get_fragment_content(target_fragment, rp, variation_dirs, repo) 
		print target_fragment_content

		if source_track.get('dirty'):
			print "X", source_track['dirty_last_snapshot_fragment_id']
			source_fragment_id = source_track['dirty_last_snapshot_fragment_id']
		else:
			source_fragment_id = source_track['last_snapshot_fragment_id']

		source_fragment = list(db.fragmentSnapshots.find({'_id': source_fragment_id}))[0]
		source_fragment_content = get_fragment_content(source_fragment, rp, variation_dirs, repo)
		print source_fragment_content

		diff_ratio = difflib.SequenceMatcher(None, source_fragment_content, target_fragment_content).ratio()

		if annotation['name'] == 'maintain-similarity':
			if 'annotated_value' in annotation:
				if annotation['annotated_value'] > diff_ratio:
					annotation['name'] = 'increase-similarity'
					annotation['auto_updated'] = True
					db.annotations.save(annotation)
					continue

		if annotation['name'] == 'increase-similarity':
			if 'annotated_value' in annotation:
				if annotation['annotated_value'] <= diff_ratio and annotation.get('auto_updated', False):
					annotation['name'] = 'maintain-similarity'
					annotation['auto_updated'] = True
					db.annotations.save(annotation)

		if has_stashed:
			unstash_changes(repo)

	# cleanup
	cleanup_dirty_fragments(db, repo)
		

if __name__ == '__main__':
	# parse arguments
	parser = argparse.ArgumentParser(description='Perform automatic propagations')
	parser.add_argument('rp', type=str, help='Path to the repository')
	parser.set_defaults(with_db=True)
	args = vars(parser.parse_args())
	rp = args['rp']
	main(rp)