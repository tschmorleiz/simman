#! /usr/bin/env python
import json
import shutil
import operator
import os.path

def extract_new(rp, variation_dirs, repo, db, commits):

    r = list(db.repos.find({'path': rp}))[0]

    extract(rp, variation_dirs, repo, db, commits, r['variants'], r['renamings'])

def extract(rp, variation_dirs, repo, db, commits, all_variants={}, all_renamings={}):

    # find the current variation directory
    def find_variation_dir(rp, variation_dirs):
        for candidate in variation_dirs:
            full_candidate = os.path.join(rp, candidate)
            if os.path.isdir(full_candidate):
                return candidate
        return None

    # extract all variants at commit
    def from_commit(commit, last_commit):
        print "> " + commit.hexsha
        # first, checkout the commit
        repo.git.checkout(commit.hexsha)
        # find the current variation directory
        variation_dir = find_variation_dir(rp, variation_dirs)
        full_variation_dir = os.path.join(rp, variation_dir)
        variants = filter(lambda x: x[0] != '.', os.listdir(full_variation_dir))
        # keep track of renaming
        renamings = []
        # vote for most probable renaming
        voting = {}
        # block list for renaming sources
        blocked_from = []
        # block list for renaming targets
        blocked_to = []
        if last_commit is not None:
            # lookup diffs
            diff_index = commit.parents[0].diff(other=commit, create_patch=True)
            rename_diffs = list(diff_index.iter_change_type('R'))
            edit_diffs = list(diff_index.iter_change_type('M'))
            # check edit diffs to extend blocked_to
            for diff in edit_diffs:
                if diff.a_blob.path != diff.b_blob.path:
                    continue
                path = os.path.relpath(diff.b_blob.path, variation_dir).split("/")[0]
                if path not in blocked_to:
                    # check if renaming is not a variant renaming
                    if path not in variants:
                        blocked_to.append(path)
            # check renaming diffs to extend blocked_from and voting
            for rename_diff in rename_diffs:
                if rename_diff is None:
                    continue
                # compute relative paths
                rel_path_from = os.path.relpath(rename_diff.rename_from, variation_dir)
                rel_path_to = os.path.relpath(rename_diff.rename_to, variation_dir)
                if rel_path_from[0] == '.' or rel_path_to[0] == '.':
                    continue
                name_from = rel_path_from.split("/")[0]
                name_to = rel_path_to.split("/")[0]
                if name_from != name_to:
                    # if names don't match extend voting
                    if name_from not in voting:
                        voting[name_from] = {}
                    if name_to not in voting[name_from]:
                        voting[name_from][name_to] = 0
                    voting[name_from][name_to] = voting[name_from][name_to] + 1
                else:
                    # else extend blocked_from
                    blocked_from.append(name_from)
        picks_from = []
        picks_to = []
        # evaluate voting
        for name_from in voting:
            # check if blocked
            if name_from in blocked_from:
                continue
            picks_from.append(name_from)
            # lookup top vote
            top_name_to = sorted(voting[name_from].iteritems(), key=operator.itemgetter(1))[-1][0]
            # create renaming if not blocked
            if top_name_to not in blocked_to:
                picks_to.append(top_name_to)
                renamings.append({"from": name_from, "to": top_name_to})
        # check splits
        print " > Variants:"
        for variant in variants:
            print "  > " + variant
        print "> Renamings:"
        for idx, renaming in enumerate(renamings):
            isSplit = renaming["from"] not in picks_to and renaming["from"] in variants
            renaming["isSplit"] = isSplit
            renamings[idx] = renaming
            print "  > " + renaming['from'] + "->" + renaming['to'] + " (split? " + str(isSplit) + ")"
        return (renamings, variants)

    print "Extracting from " + str(len(commits)) + " commits."

    # save results
    last_commit = None
    # extract variants from each commit
    for commit in commits:
        (current_renamings, current_variants) = from_commit(commit, last_commit)
        all_variants[commit.hexsha] = current_variants
        if len(current_renamings) > 0:
            all_renamings[commit.hexsha] = current_renamings
        last_commit = commit

    document = {}
    document["variants"] = all_variants
    document["renamings"] = all_renamings
    #print document
    db.repos.update({"path": rp}, {"$set" : document}, upsert=False, multi=False)
