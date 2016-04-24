var user = require ('./user');
exports.login = login;

function login(req, res, next){
	if(req.session.user) {
		return;
	}
  	var username = req.body.username;
	var password = req.body.pwd;

	//auth
	user.authenticate(username, password, function(err, msg, resultedUser){
		if (err) return next(err);
	    if (resultedUser) {
  			var logDate = new Date();
  			console.log(logDate + ' INFO ' + 'LOGIN ' + resultedUser.name +' connected');
			req.session.user = {id: resultedUser.id, email: resultedUser.email, name: resultedUser.name};
			req.session.redirectmessage = 'You were successfuly logged in.';
			res.redirect('/home');
		} else {
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
		res.redirect('/login');
	}
}