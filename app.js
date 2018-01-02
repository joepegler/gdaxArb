(function(){
	'use strict';

	const _ = require('lodash');
	const Gdax = require('gdax');
	const telegram = require('./telegram');
	const publicClient = new Gdax.PublicClient();

	let priceData = {
	  // "BTC-EUR": {
	  //   "bid": 15153.46,
	  //   "ask": 15153.47
	  // },
	  // "ETH-BTC": {
	  //   "bid": 0.04659,
	  //   "ask": 0.0466
	  // },
	  // "ETH-EUR": {
	  //   "bid": 690,
	  //   "ask": 691
	  // },
	  // "LTC-BTC": {
	  //   "bid": 0.01969,
	  //   "ask": 0.0197
	  // },
	  // "LTC-EUR": {
	  //   "bid": 299.1,
	  //   "ask": 299.11
	  // }
	  // "BCH-BTC": {
	  //   "bid": .2,
	  //   "ask": .21
	  // },
	  // "BCH-EUR": {
	  //   "bid": 3000,
	  //   "ask": 3001
	  // }
	};

	const baseAndQuotePairs = {
		'BTC' : /* Can be bought with: */ ['EUR'],
		// 'BCH' : /* Can be bought with: */ ['EUR', 'BTC'],
		'LTC' : /* Can be bought with: */ ['EUR', 'BTC'],
		'ETH' : /* Can be bought with: */ ['EUR', 'BTC']
	};

	let availablePairs = [];
	let balances = {
		'BTC' : 3,
		'LTC' : 50,
		'ETH' : 20,
		// 'BCH' : 8
	};

	_.each(baseAndQuotePairs, (quoteCoinArray, baseCoinName) => {
		_.each(quoteCoinArray, quoteCoin => { availablePairs.push(baseCoinName + '-' + quoteCoin) });
	})

	const websocket = new Gdax.WebsocketClient(availablePairs);

	function checkForOpportunity(){

		_.each(priceData, (bidAndAsk, pairName) => {

			let baseCoinName = pairName.substring(0, 3);

			let currentQuoteArray = baseAndQuotePairs[baseCoinName];

			currentQuoteArray.forEach( quoteCoin => {

				// If the quoteCoin is also a base coin there is opportunity for arbitrage
				if ( baseAndQuotePairs[quoteCoin] ){

					// if the iterating coins includes all of the currentQuote array there is opportunity for arbitrage
					if ( _.isEqual(currentQuoteArray, baseAndQuotePairs[quoteCoin].concat(quoteCoin)) ){

						let intermediaryCoin = _.without(currentQuoteArray, quoteCoin)[0];

						let balance = balances[baseCoinName];

						// First sell the basecoin for intermediary. eg 100 litecoin for euros. There is a taker fee of .025
						let intermediaryBalance = (balance * priceData[baseCoinName + '-' + intermediaryCoin].bid * 0.975);

						// Now buy your quoteCoin with the intermediary balance. eg buy bitcoin with euros. There is a taker fee of .025
						let quoteCoinBalance = ( intermediaryBalance / priceData[quoteCoin + '-' + intermediaryCoin].ask * 0.975 );

						let routeOneBalance = (balance * priceData[baseCoinName + '-' + quoteCoin].bid * 0.975);

						if ( quoteCoinBalance > routeOneBalance){

							let percentageDifference = parseFloat(((quoteCoinBalance - routeOneBalance) / quoteCoinBalance) * 100);

							telegram.broadcast('Sell ' + baseCoinName + ' for ' + quoteCoin + ' for a percentage gain: ' + percentageDifference );
						}
					}
				}
			})
		})
	}

	function isReady(data){
		if(_.keys(data).length !== availablePairs.length) return false;
		var ready = true;
		_.each( priceData, function( pricePoint, pairName ){
			if ( !_.isNumber(pricePoint.bid) || !_.isNumber(pricePoint.ask) ){
				ready = false;
			}
		})
		return ready;
	}

	var ready = false;

	websocket.on('message', data => {

		if(data.type === 'match' && availablePairs.includes(data.product_id)) { 

			priceData[data.product_id] = (priceData[data.product_id] || { bid: undefined, ask: undefined });
			priceData[data.product_id][data.side === 'buy' ? 'bid' : 'ask'] = parseFloat(data.price);

			if (!ready){
				if(isReady(priceData)) {
					ready = true;
				}
			}
			else {
				checkForOpportunity();
			}
		}

	});

	websocket.on('error', console.error);
	websocket.on('close', console.error);

})();