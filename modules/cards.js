// var MongoClient = 	('mongodb').MongoClient;
// var url = 'mongodb://localhost:27017/test';
// var CARD_COLLECTION = 'cards';

var cardNames=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];
var cards = {};

exports.template = template;
function template(){
	cardNames.forEach(function(cName){
		cards[cName] = new Card(cName);
	});
	// var at = 0, nt = 0, spades=0;
	
	// for (index in cards){
	// 	at += cards[index].allTrumpsPoints;
	// 	nt += cards[index].noTrumpsPoints;
	// 	spades += (cards[index].color == 'S'? cards[index].trumpPoints:cards[index].points);
	// }
	// console.log({
	// 	at:at,
	// 	nt:nt,
	// 	normal:spades
	// });
	return cards;
}

// function Card(value, color, points, trumpPoints, order, trumpOrder){
function Card(card){
	this.color = card.substr(-1);
	this.value = card.substr(0, card.length-1);
	var info = getCardInfo(this.value);

	this.order = info.order;
	this.trumpOrder=info.trumpOrder;
	this.points = info.points;
	this.trumpPoints = info.trumpPoints;
	this.noTrumpsPoints = info.noTrumpsPoints;
	this.allTrumpsPoints = info.allTrumpsPoints;

	this.isGreaterThan = function(card, trump){
		var order= (trump?'trumpOrder':'order');
		return this[order] > card[order];
	}

}

function getCardInfo(value){
	var res = {};
	switch(value){
		case '7':
			res.order=1;
			res.trumpOrder=1;
			res.points=0;
			res.trumpPoints=0;
			res.allTrumpsPoints=0;
			res.noTrumpsPoints=0;
		break;
		case '8':
			res.order=2;
			res.trumpOrder=2;
			res.points=0;
			res.trumpPoints=0;
			res.allTrumpsPoints=0;
			res.noTrumpsPoints=0;
		break;
		case '9':
			res.order=3;
			res.trumpOrder=7;
			res.points=0;
			res.trumpPoints=14;
			res.allTrumpsPoints=9;
			res.noTrumpsPoints=0;
		break;
		case '10':
			res.order=7;
			res.trumpOrder=5;
			res.points=10;
			res.trumpPoints=10;
			res.allTrumpsPoints=6;
			res.noTrumpsPoints=10;
		break;
		case 'J':
			res.order=4;
			res.trumpOrder=8;
			res.points=2;
			res.trumpPoints=20;
			res.allTrumpsPoints=12;
			res.noTrumpsPoints=2;
		break;
		case 'Q':
			res.order=5;
			res.trumpOrder=3;
			res.points=3;
			res.trumpPoints=3;
			res.allTrumpsPoints=2;
			res.noTrumpsPoints=3;
		break;
		case 'K':
			res.order=6;
			res.trumpOrder=4;
			res.points=4;
			res.trumpPoints=4;
			res.allTrumpsPoints=2;
			res.noTrumpsPoints=4;
		break;
		case 'A':
			res.order=8;
			res.trumpOrder=6;
			res.points=11;
			res.trumpPoints=11;
			res.allTrumpsPoints=7;
			res.noTrumpsPoints=19;
		break;
		default:
			console.log('card error');
	}
	return res;
}