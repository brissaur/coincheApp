var MongoClient = 	('mongodb').MongoClient;
var Cards = require(__dirname +'/cards').template();

// var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';
var colorValues = {H: 0, S: 1, D:2,C: 3}

exports.newDeck = newDeck;
function newDeck(){
	return new Deck;
}

function Deck(){
	this.init=function(){
		this.cards =['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];
		this.shuffle();
	}
	this.shuffle=function(){
	    for(var j, x, i = this.cards.length; i; j = Math.floor(Math.random() * i), x = this.cards[--i], this.cards[i] = this.cards[j], this.cards[j] = x);
	};
	this.distribute=function(){
		var resultedDeck = [];
		if (this.cards.length == 0) this.init();
		this.cutDeck();
		var p1 = [].concat(this.cards.slice(0,3),this.cards.slice(12,15),this.cards.slice(24,26));
		var p2 = [].concat(this.cards.slice(3,6),this.cards.slice(15,18),this.cards.slice(26,28));
		var p3 = [].concat(this.cards.slice(6,9),this.cards.slice(18,21),this.cards.slice(28,30));
		var p4 = [].concat(this.cards.slice(9,12),this.cards.slice(21,24),this.cards.slice(30,32));
		var resultedDeck = [cardSort(p1),cardSort(p2),cardSort(p3),cardSort(p4)];
		this.cards=[];
		return resultedDeck;
	};
	this.cards=[];
	this.collectTrick = function(trick, team){
		this.teamTricks[team]=this.teamTricks[team].concat(trick.reverse());
	}
	this.cutDeck = function(){
		var coupure = Math.floor(Math.random() * 15 + Math.random() * 15);
		var resultedDeck = [].concat(this.cards.slice(coupure, 32),this.cards.slice(0,coupure));
		this.cards = resultedDeck;
	}
	this.fusionTeamTricks = function(){
		var rand = Math.floor(Math.random()*2);
		this.cards = this.teamTricks[(rand+1)%2].concat(this.teamTricks[rand]);
		this.teamTricks[0] = [];
		this.teamTricks[1] = [];
	}
	this.teamTricks = [[],[]];
}

function cardSort(cards){
	var tab = cards
	var swapped;
    do {
        swapped = false;
        for (var i=0; i < tab.length-1; i++) {
	        if ( (colorValues[Cards[tab[i]].color] > colorValues[Cards[tab[i+1]].color]) || ( (colorValues[Cards[tab[i]].color] == colorValues[Cards[tab[i+1]].color]) && (Cards[tab[i]].order > Cards[tab[i+1]].order) ) ){
                var temp = tab[i];
                tab[i] = tab[i+1];
                tab[i+1] = temp;
                swapped = true;
            }
        }
    } while (swapped);
	return tab;
}
