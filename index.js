const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const git = require('nodegit');
const path = require('path');
const app = express();
const fs = require('fs');
const fse = require('fs-extra');
const exec = require('child_process').execSync;
const os = require('os');
const process = require('process');

const config = {
    name: 'cryo-recipes-db',
    port: 3000,
    host: '0.0.0.0',
};

// just read into mem
const repoUrl = "git@github.com:slaclab/cryo-recipes.git";
const repoPath = "/tmp/master/";
const dbPath = 'public/papers.json';

// set the ssh key to use
const ssh_key=process.env.SSH_KEY;
console.log( "Using ssh key at "  + ssh_key );
process.env.GIT_SSH_COMMAND = "ssh -i " + ssh_key


// helper functions
var rmdir = ( dir ) => {
	// console.log( 'removing ' + dir );
	fs.rmdirSync( dir, {recursive:true}, (err) => {
		if (err) { console.error(err); }
	})	
};

// create new branch branchName at repo path branchPath and send a pull request
// var submit = ( branchName, branchPath ) => {
// 	var dir = path.resolve( branchPath );
// 	// duplicate master
// 	rmdir( dir );
// 	fse.copySync( repoPath, dir );
// 	console.log("creating new branch " + branchName + " at " + dir );
//
// 	return git.Repository.open( dir )
// 	.then( (repo) => {
// 		return repo.getHeadCommit()
// 		.then( (commit) => {
// 			return repo.createBranch( branchName, commit, 0 )
// 			.then( (ref) => {
// 				// console.log(ref);
// 				// return repo.checkoutRef(ref);
// 				repo.checkoutRef(ref);
// 				return repo;
// 			})
// 		})
// 	})
// }

// grab newest db from repoUrl and read into memory
console.log("Cloning " + repoUrl + " to " + repoPath );
rmdir( repoPath );
// var repo = git.Clone( repoUrl, repoPath, {} )
// .then( (repo) => {
// 	console.log("cloned!");
// 	const repoDbPath = repoPath + dbPath;
// 	console.log("loading " + repoDbPath );
// 	db = JSON.parse(fs.readFileSync( repoDbPath, 'utf8', (err) => {
// 		if (err) {
// 			console.err(err);
// 		}
// 	}));
// 	//console.log(db);
// })

exec( "git clone " + repoUrl + " " + repoPath);
const repoDbPath = repoPath + dbPath;
const db = JSON.parse(fs.readFileSync( repoDbPath, 'utf8', (err) => {
	if (err) { console.err(err); process.exit(255); }
}));
console.log("Ready...")

// exec( 'git config user.name "author"' );
// exec( 'git config user.email "author@somewhere.org"' );

// express settings
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// list all papers
app.get('/papers', (req, res) => {
	// console.log( papersData );
	res.send( db );
})



var create_pr = ( branchName, newdb ) => {

	var dir = path.resolve( '/tmp/' + branchName );
	// duplicate master
	rmdir( dir );
	fse.copySync( repoPath, dir );
	console.log("creating new branch " + branchName + " at " + dir );
	
	process.chdir(dir);
	exec( "git checkout -b " + branchName );
	const newdbPath = dir + '/' + dbPath;
	fs.createWriteStream(newdbPath).write( JSON.stringify(newdb, null, 2) );

	// commit changes
	exec( "git commit -m 'new entry request' . && git push -u origin " + branchName );
	// hmm.. need different auth for hub
	// exec( "hub pull-request -m 'new entry request' -b cryo-recipes:" + branchName + " -h cryo-recipes:master");

	// create PR
	process.chdir( repoPath );
	// rmdir( dir );

}

// add new paper 
app.put('/paper/new', (req, res) => {
	const item = req.body;
	console.log(item);
	
	// copy
	db2 = JSON.parse( JSON.stringify(db) );
	db2.push( item );

	// create new branch
	var branchName = 'new';
	create_pr( branchName, db2 );
	
	// clean up
	res.status(200).send(item);

})

// get single paper
app.get('/paper/:id', (req, res) => {
	const id = req.params.id;
	res.send(db[id]);
})


app.post( '/paper/:id', (req, res) => {

	var id = req.params.id;

	// modify entry
	var db2 = JSON.parse( JSON.stringify(db) );
	db2[id] = req.body;

	var branchName = 'mod-' + id;
	create_pr( branchName, db2 );

	// clean up
	res.status(200).send(db2[id]);

})

// update paper
// app.post( '/paper/:id', (req, res) => {
//
// 	var id = req.params.id;
//
// 	// modify entry
// 	var db2 = JSON.parse( JSON.stringify(db) );
// 	db2[id] = req.body;
//
// 	var branchName = 'other';
// 	var branchPath = '/tmp/' + branchName + '/';
// 	submit( branchName, branchPath )
// 	.catch( (err) => {
// 		console.error(err);
// 		res.status(500);
// 	})
// 	.done( () => {
//
// 		// make changes to db in new checkout
// 		const newdbPath = branchPath + '/' + dbPath;
// 		const str = JSON.stringify(db2, null, 2)
// 		fs.createWriteStream( newdbPath ).write( str );
//
// 		// TODO: submit PR to remote
//
// 		// rmdir( newRepo );
// 		res.status(200).send(db2[id]);
//
// 	})
//
// })


// start server
app.listen(config.port, config.host, (e)=> {
    if(e) {
        throw new Error('Internal Server Error');
    }
});

