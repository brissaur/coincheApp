var testcards = ['9H','8S','JC','10H','JH','QH','KH','AH'];

var distribute = function(cards){
  // assert(cards.length==8);
  var zindex=10;
  var shiftLeft=0;
  var playerCards = $('#playerCards');
  // assert(playerCards);
  for (var i = 0; i < cards.length; i++) {
    // console.log('card'+i);
    var c = document.createElement('img');
    c.src='/images/cards/'+cards[i]+'.png';
    c.className = "card cardToBePlayed";
    c.style['z-index']=zindex
    c.style.left=shiftLeft+100;//('left', shiftLeft+100);
    zindex*=10;
    shiftLeft+=30;
    playerCards.append(c);
  }
  //TODO: print 8 cards for other player
}

var timeToPlay = function(gameID){
  $('#playerCards').children()
      .css('border','thin solid red')
      .on('click', function (event){
        var isItATen = this.src.substr(-7,2)=='10';
        var firstIndex = isItATen? -7:-6;
        var length = isItATen? 3:2;
        var targetCard =this.src.substr(firstIndex,length);

        socket.emit('play', {card: targetCard, gameID:gameID});
        $('#playerCards').children().css('border','').unbind('click');
        this.parentNode.removeChild(this);
      });
}

// distribute(testcards); 

