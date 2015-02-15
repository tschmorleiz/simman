#! /usr/bin/env python
import json
import shutil
import operator
import os.path

def extract_new(rp, variation_dirs, repo, db, commits):

    r = list(db.repos.find({'path': rp}))[0]

    extract(rp, variation_dirs, repo, db, commits, r['messages'], r['actions'], first_is_first=False)

def extract(rp, variation_dirs, repo, db, commits, all_messages=[], all_actions=[], first_is_first=True):

    # make a generic action
    def mk_action(name):
        return {"name": name}

    # make the first commit
    def mk_first_commit(commit):
        actions = []
        create_actions = [mk_action("create") for path in commit.stats.files.keys()]
        actions.extend(create_actions)
        commit_action = mk_action("commit")
        actions.append(commit_action)
        return (commit.message, actions)

    # make a commit
    def mk_commit(commit, last_commit):
        print "> " + commit.hexsha
        actions = []
        diff_index = last_commit.diff(other=commit, create_patch=True)

        new_diffs = list(diff_index.iter_change_type('A'))
        print " > " + str(len(new_diffs)) + " new files."
        actions.extend([mk_action("create") for d in new_diffs if d is not None])

        rename_diffs = list(diff_index.iter_change_type('R'))
        print " > " + str(len(rename_diffs)) + " renamed files."
        actions.extend([mk_action("rename") for d in rename_diffs if d is not None])

        edit_diffs = list(diff_index.iter_change_type('M'))
        print " > " + str(len(edit_diffs)) + " modified files."
        actions.extend([mk_action("edit") for d in edit_diffs if d is not None])

        delete_diffs = list(diff_index.iter_change_type('D')) 
        print " > " + str(len(delete_diffs)) + " deleted files."
        actions.extend([mk_action("delete") for d in delete_diffs if d is not None])

        commit_action = mk_action("commit")
        actions.append(commit_action)

        return (commit.message, actions)



    print "Extracting from " + str(len(commits)) + " commits."

    # get messages & actions for every commit
    if first_is_first:
        last = commits[0]
        (first_message, first_actions) = mk_first_commit(commits[0])
        all_messages.append({"hexsha": commits[0].hexsha, "message": first_message})
        all_actions.append(first_actions)
        start_index = 1
    else:
        last = commits[0].parents[0]
        start_index = 0

    for commit in commits[start_index:]:
        (new_message, new_actions) = mk_commit(commit, last)
        all_actions.extend(new_actions)
        all_messages.append({"hexsha": commit.hexsha, "message": new_message})
        last = commit

    print "Extracted " + str(len(all_actions)) + " actions." 


    action_names = ["create", "delete", "rename", "edit", "commit"]

    document = db.repos.find_one({"path": rp})
    if document is None:
        document = {}

    document["path"] = rp
    document["name"] = os.path.basename(os.path.normpath(rp))
    document["messages"] = all_messages
    document["action_names"] = action_names
    document["actions"] = all_actions
    db.repos.save(document)
