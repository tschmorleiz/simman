# INSTALLATION


## Setting the environment variable

First add the environment variable ANN_PATH to your .bashrc file in your home folder. Point it to the root folder of Ann, for instance:

<code>export ANN_PATH=/home/user1/Projects/vcs_next</code>

## Integrating into Git

To integrate Ann into git copy the file <code>scripts/git-ann</code> into the folder <code>/usr/local/bin</code> and make it executable by running <code>chmod +x git-ann</code>

## Installing the Database

For Ann to store the extracted metadata and annotations MongoDB has to be installed. For how to install MongoDB see the installation guides for [Ubuntu](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/) or [MacOS](http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/).

## Installing python packages

A proper package declaration will follow. For now, please install the following python packages:
* GitPython
* pymongo
* findtools

## Installing node

Install node and npm for [Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-an-ubuntu-14-04-server) or [MacOS](http://shapeshed.com/setting-up-nodejs-and-npm-on-mac-osx/).

On Ubuntu the executable is not called <code>node</code> but <code>nodejs</code>. You will have to create an alias, e.g. by running <code>ln -s /usr/bin/nodejs /usr/bin/node</code>.

Finally, install the all dependencies via <code>npm install</code>, start the server via <code>node server</code>, and go to <code>http://localhost:3000</code>.


## Extracting metadata

To extract metadata run <code>git ann init</code> in the repository for which you want to annotate similarities. Run <code>git ann update</code> to extract metadata from new commits.

## Annotating

After selecting the your repository in Ann, you can select a commit- and a variant-centric annotator.

### Commit-centric annotator

This one provides a list of commits and for each commit lists all fragments for which a similarity first emerged at the commit. After selecting a fragment you are provided with all similarities and can annotate them.

### Variant-centric annotator

This one provides a graph of all variants with their similarities as edge weights. After selecting a variant (node) in the graph you can navigate the variant's folders, files, and fragments and can see all similar folders, files, and fragments. After selecting a fragment on both sides you can annotate the similarity.

## Results of annotations

### TODO list

After annotating our system provides a TODO list for the repository. Each item is a maintenance task that corresponds to an annotation. Each task then has to be performed manually by a user or can be executed automatically.

### Change propagation

Some annotations are automatically "executable" by using 3-way-merge. Run <code>git ann propagate</code> to trigger the execution.

## CASE STUDY

To reproduce the results of the case study perform the following steps.

After each step you can get all metrics results by executing the following <code>casestudy</code> <code>python metrics.py 101haskell PATH_TO_REPO DATEBASE_NAME</code>

# Initial extraction

* Head to the [101haskell repo](https://github.com/tschmorleiz/101haskell) and check it out on your machine.
* Execute <code>git ann init</code> to trigger the initial metadata extraction

# Automatic change propagation

Do the following for all annotation dump files <code>casestudy/dumps/annotations_0.json ... _3.json</code>.

* Import the annotation file by executing the following in <code>casestudy</code> <code>annotation_importer.py DATEBASE_NAME annotations_x.json PATH_TO_REPO</code>
* Go to the repo and execute <code>git ann propagate</code>

The result will a repo where all files have content like [at this commit point](https://github.com/101companies/101haskell/commit/2546d68e2eb66c820c517ca82f6a029ce24d4b0d)

# Manually establishing equalities

* Import the annotation file by executing the following in <code>casestudy</code> <code>annotation_importer.py DATEBASE_NAME annotations_5.json PATH_TO_REPO</code>
* Manually establish equalities as found as tasks in the TODO list.

The result could be a repo where all files have content like [at this commit point](https://github.com/101companies/101haskell/commit/8b15416025bd239940bc9a2d91a1701794dfb318)

# Manually increasing equalities

* Head to the TODO list and perform all remaining tasks

The result could be a repo where all files have content like [at this commit point](https://github.com/101companies/101haskell/commit/3ccbbbd2509ea33b1c117255a8f372e4f386af73)



