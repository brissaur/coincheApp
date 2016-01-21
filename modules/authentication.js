var user = require ('./user');
exports.login = login;

function login(req, res, next){
	if(req.session.user) {
		console.log('User already logged in');
		return;
	}
  	var username = req.body.username;
	var password = req.body.pwd;
	console.log('username= '+ username+ '+password=' + password );

	//auth
	user.authenticate(username, password, function(err, msg, resultedUser){
		if (err) return next(err);
	    if (resultedUser) {
			req.session.user = {id: resultedUser.id, email: resultedUser.email, name: resultedUser.name};
			console.log('Login success');
			req.session.redirectmessage = 'You were successfuly logged in.';
			res.redirect('/home');
		} else {
			console.log('signin failed: '+ err + msg);
			req.session.redirectmessage='Login failed - ' + err + msg;
		 	res.redirect('/login');
		}
	});
}

exports.logout = logout;
function logout(req, res, next){
	req.session.user=null;
	next();
}

exports.checkAuthorized = checkAuthorized;
function checkAuthorized(req, res, next){
	if (req.session.user){
		//if rights OK
		next();
	} else {
		req.session.redirectmessage = 'You need to be logged in to access this page.';
		console.log(res.locals.redirectmessage);
		res.redirect('/login');
	}
}