var MongoClient = 	('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';

exports.newDeck = newDeck;
function newDeck(){
	return new Deck;
}

function Deck(){
	this.cards=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];
	this.shuffle=function(){
	    for(var j, x, i = this.cards.length; i; j = Math.floor(Math.random() * i), x = this.cards[--i], this.cards[i] = this.cards[j], this.cards[j] = x);
	};
	this.test=function(){
		// console.log('hello');
		console.log( this.cards.slice(0,8));
	};
	this.distribute=function(){
		return [this.cards.slice(0,8).sort(),this.cards.slice(8,16).sort(),this.cards.slice(16,24).sort(),this.cards.slice(24,32).sort()];
		//use splice()
	};
}
// exports.test = 'hello';
// exports.create=create;
// function create(req, res, callback){//