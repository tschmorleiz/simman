import argparse

import propagate.propagate as p
import extractors.new_extractor as ne
import initializer.initializer as init

# parse arguments
parser = argparse.ArgumentParser(description='Perform an ann action')
parser.add_argument('action', type=str, help='Action to perform')
parser.add_argument('rp', type=str, help='Path to the repository')
parser.set_defaults(with_db=True)
args = vars(parser.parse_args())
action = args['action']
rp = args['rp']

supported_actions = ['init', 'update', 'propagate']
actions_help = {
	'init'      : '\t\t: Initialize ann for this repository',
	'update'    : '\t: Extract metadata for any new commits',
	'propagate' : '\t: Automatically propagate changes based on annotations'
}

if action not in supported_actions:
	if action != 'help':
		print 'Action not supported.',
	print 'Supported actions:'
	print
	for sa in supported_actions:
		print ' - ' + sa + actions_help[sa]
	print

if action == 'propagate':
	p.main(rp)

if action == 'update':
	ne.extract_new(rp)

if action == 'init':
	init.initialize(rp)	


