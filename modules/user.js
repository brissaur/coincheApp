var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var USER_COLLECTION = 'users';

function hash(text){
	return text;//todo
}
// comment on fait le faux sso - on le garde ou cette connerie - a laquelle on doit avec acces parytout

exports.create=create;
function create(req, res, callback){//securité transfert mdp
	email=req.body.email;
	password=req.body.pwd;
	name=req.body.username;
	console.log('email= '+ email+ '+password=' + password +'+name=' + name + '');
	
	if(email==""){
		msg='Please input an email.';//Todo: distinction error systemee/error algo
		return callback(null,msg);
	}
	if(password==""){
		msg='Please input a password.';//Todo: distinction error systemee/error algo
		return callback(null,msg);
	}
	if(name==""){
		msg='Please input a username.';//Todo: distinction error systemee/error algo
		return callback(null,msg);
	}

	var user = {
	    email: email,
	    password: hash(password),
	    name: name
	  }
  	MongoClient.connect(url, function(err, db){
		if (err) return callback(err);
  		db.collection(USER_COLLECTION).find({name: name}).toArray(function(err, res){//TODO: probleme user unique plus simple.
  			if (err) return callback(err);
  			if (res.length >0){
  				var msg = 'Username already exists';
  				return callback(null, msg);
  			}
			db.collection(USER_COLLECTION).insert(user,function(err, res){
				if (err) return callback(err);
		    	callback(null, null, res.ops[0]._id);//todo pourquoi
			});
		});
	});
}

// function remove(id, callback){//todo pourquoi id ?
//   	MongoClient.connect(url, function(err, db){
// 		db.collection(USER_COLLECTION).remove({_id: id},function(err, res){
// 			callback(err);
// 		});
// 	});
// }
exports.authenticate=authenticate;
function authenticate(username, password, callback) {
	MongoClient.connect(url, function(err, db){
		if (err) return callback(err);
  		db.collection(USER_COLLECTION).findOne({name:username}, function(err, doc) {
    		if (err) return callback(err);
    		if (!doc) return callback(null, 'Username undefined', null);
		    if (doc.password === hash(password)) {
		      callback(null, null, doc);
		    } else {
		      callback(null, "Wrong password : '"+doc.password+"' vs '"+hash(password)+"'", null);
		    }
		    db.close();
		});
	});
}
//hashMap matchant username <-> User

// Account Creation
// Create a user schema to hold user data
// Create accounts and store salt + hashed passwords using bcrypt / scrypt
// Sending an email with token for account verification

// Account Authentication
// Authenticate the user (comparing hashes)

// Account Management
// Password reset work flow
// Generating / invalidating tokens
// Role-based access / permissions
// Integrations with ID and Social Providers

// Secure the system
// Secure the Database from unauthorized access
// Secure the OS from unauthorized access
// Backups for data