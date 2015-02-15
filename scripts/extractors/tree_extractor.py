#! /usr/bin/env python
import json
import shutil
from subprocess import *
from git import *
import os.path
from bson.objectid import ObjectId
from findtools.find_files import (find_files, Match)
 

def find_variation_dir(rp, variation_dirs):
    for candidate in variation_dirs:
        full_candidate = os.path.join(rp, candidate)
        if os.path.isdir(full_candidate):
            return candidate
    return None

def clean_path(variation_dir, variant, path):
    return os.path.relpath(path, os.path.join(variation_dir, variant))

def get_file(rp, variation_dir, variant, blob, parent_path, hexsha, config, db):
    clean = clean_path(variation_dir, variant, blob.path)
    name = os.path.relpath(clean, parent_path)
    extension = os.path.splitext(name)[1][1:]
    if extension not in config.keys():
        return None
    tree = {
        "name": os.path.relpath(clean, parent_path),
        "kind": "file",
        "path": clean,
        "children": [],
        "evolution_count": count_evolutions(rp, variant, clean, db)
    }
    print blob.path + ' ~ ' + clean
    fragments = db.fragmentSnapshots.find({"sha": hexsha, "variant": variant, "relative_path": clean})
    for f in fragments:
        tree["children"].append({
            "kind": "fragment",
            "name": f["classifier"] + "/" + f["name"],
            "path": clean + "/" + f["classifier"] + "/" + f["name"],
            "id": f["_id"],
            "evolution_count": count_evolutions(rp, variant, clean, db, classifier=f["classifier"], name=f["name"])
        })
    return tree

evolutions = []

def count_evolutions(rp, variant, relative_path, db, classifier=None, name=None):
    global evolutions
    if len(evolutions) == 0:
        evolutions = list(db.similarityEvolutions.find({'repo_path': rp}))
    count = 0
    if relative_path == '.':
        relative_path = ''
    print variant, relative_path, classifier, name
    for e in evolutions:
        if e['last_source_variant'] == variant and e['last_source_relative_path'].startswith(relative_path):
            if classifier and name:
                if e['last_source_classifier'] == classifier and e['last_source_name'] == name:
                    count += 1
            else:
                count += 1
        if e['last_target_variant'] == variant and e['last_target_relative_path'].startswith(relative_path):
            if classifier and name:
                if e['last_target_classifier'] == classifier and e['last_target_name'] == name:
                    count += 1
            else:
                count += 1
    print count
    return count



def get_paths(rp, variation_dir, variant, root, parent_path, hexsha, config, db):
    clean = clean_path(variation_dir, variant, root.path)
    name = os.path.relpath(clean, parent_path)
    path = clean
    kind = "folder"
    if name == ".":
        name = variant
        kind = "variant"
    tree = {
        "name": name,
        "kind": kind,
        "path": path,
        "children": [],
        "evolution_count": count_evolutions(rp, variant, clean, db)
    }
    print root.path + ' ~ ' + clean
    for b in root.blobs:
        child = get_file(rp, variation_dir, variant, b, clean, hexsha, config, db)
        if child is not None:
            tree["children"].append(child)
    for t in root.trees:
        tree["children"].append(get_paths(rp, variation_dir, variant, t, clean, hexsha, config, db))
    return tree

def extract(rp, variation_dirs, repo, db, commit):
 
    config = json.load(open(os.path.dirname(os.path.realpath(__file__)) + '/../config.json'))['fragments-tech']

    last_hexsha = commit.hexsha
     
    repo.git.checkout(last_hexsha)
    db.trees.remove({"repo_path": rp})
    variants = list(db.repos.find({'path': rp}))[0]['variants'][last_hexsha]
    variation_dir = find_variation_dir(rp, variation_dirs)
    tree = repo.tree()
    candidates = filter(lambda x: x.path == variation_dir, tree.trees)
    if len(candidates) == 0:
        root_tree = tree
    else:
        root_tree = candidates[0]
     
    for variant in variants:
        candidates = filter(lambda x: x.path == os.path.join(variation_dir, variant), root_tree.trees)
        if len(candidates) == 0:
            continue
        variant_root_tree = candidates[0]
        tree = get_paths(rp, variation_dir, variant, variant_root_tree, '', last_hexsha, config, db)
        db.trees.insert({"repo_path": rp, "variant": variant, "tree": tree})