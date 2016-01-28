var MongoClient = 	('mongodb').MongoClient;

var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';
var Cards = require(__dirname +'/cards').template();
var colorValues = {H: 0, S: 1, D:2,C: 3}
exports.newDeck = newDeck;
function newDeck(){
	return new Deck;
}

function Deck(){
	this.shuffle=function(){
	    for(var j, x, i = this.cards.length; i; j = Math.floor(Math.random() * i), x = this.cards[--i], this.cards[i] = this.cards[j], this.cards[j] = x);
	};
	this.test=function(){
		// console.log('hello');
		console.log( this.cards.slice(0,8));
	};
	this.distribute=function(){
		return [cardSort(this.cards.slice(0,8)),cardSort(this.cards.slice(8,16)),cardSort(this.cards.slice(16,24)),cardSort(this.cards.slice(24,32))];
		// return [this.cards.slice(0,8).sort(),this.cards.slice(8,16).sort(),this.cards.slice(16,24).sort(),this.cards.slice(24,32).sort()];
		//use splice()
	};
	this.cards=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];
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
