const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
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
const repoUrl = "git@github.com:slaclab/cryo-recipes-db.git";
const repoPath = "/tmp/master/";
const dbPath = 'data/papers.json';

// set the ssh key to use
console.log( "Using "  + process.env.GIT_SSH_COMMAND );
exec( "git --version" );


// helper functions
var rmdir = ( dir ) => {
	// console.log( 'removing ' + dir );
	fs.rmdirSync( dir, {recursive:true}, (err) => {
		if (err) { console.error(err); }
	})	
};

// grab newest db from repoUrl and read into memory
console.log("Cloning " + repoUrl + " to " + repoPath );
rmdir( repoPath );

exec( "git clone " + repoUrl + " " + repoPath);
const repoDbPath = repoPath + dbPath;
const db = JSON.parse(fs.readFileSync( repoDbPath, 'utf8', (err) => {
	if (err) { 
    console.err(err); 
    process.exit(255);
  }
}));

// express settings
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// start server
app.listen(config.port, config.host, (e)=> {
  if(e) {
    throw new Error('Internal Server Error');
  }
  console.log("Ready...")
});


app.get('/status', (req,res) => {
  res.send('ok!');
})

// list all papers
app.get('/api/papers.json', (req, res) => {
	// console.log( papersData );
	res.send( db );
})



var create_pr = ( branchName, newdb ) => {

	var dir = path.resolve( '/tmp/' + branchName );

  return new Promise( (resolve,reject) => {

  	// duplicate master
	  rmdir( dir );
	  fse.copySync( repoPath, dir );
	  console.log("creating new branch " + branchName + " at " + dir );
	
	  process.chdir(dir);
	  exec( "git checkout -b " + branchName );
	  const newdbPath = dir + '/' + dbPath;
	  var d = fs.createWriteStream(newdbPath)
    d.on( 'finish', () => {
      // commit changes
      exec( 'git config user.name "author" && git config user.email "author@somewhere.org"' );
      exec( "git commit -m 'new entry request' . && git push -u origin " + branchName );
      // hmm.. need different auth for hub
      // exec( "hub pull-request -m 'new entry request' -b cryo-recipes:" + branchName + " -h cryo-recipes:master");
      // create PR
      // rmdir( dir );
    });
    d.on("error", (err) => {
      console.error(err);
      reject(err);
    });
    d.write( JSON.stringify(newdb, null, 2) );
    d.end();

	  process.chdir( repoPath );
    resolve( newdb );
  })
}

// add new paper 
app.put('/api/paper/new', (req, res) => {
	const item = req.body;
	console.log(item);
	
	// copy
	db2 = JSON.parse( JSON.stringify(db) );
	db2.push( item );

	// create new branch
	var branchName = 'new';
	var pr_promise = create_pr( branchName, db2 )
  .then( (d) => {
	  res.status(200).send(item);
  })
	.catch( (err) => {
    res.status(500)
  });

})

// get single paper
app.get('/api/paper/:id', (req, res) => {
	const id = req.params.id;
	res.send(db[id]);
})


app.post( '/api/paper/:id', (req, res) => {

	var id = req.params.id;

	// modify entry
	var db2 = JSON.parse( JSON.stringify(db) );
	db2[id] = req.body;

	var branchName = 'mod-' + id;
	create_pr( branchName, db2 );

	// clean up
	res.status(200).send(db2[id]);

})

