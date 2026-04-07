const WebSocket = require('ws');
const ws = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price?apikey=bc09fcb14a674a1ea53adcc2a8cde834');

ws.on('open', function open() {
  console.log('Connected to Twelve Data');
  ws.send(JSON.stringify({
    "action": "subscribe",
    "params": {
      "symbols": "RELIANCE:NSE,TCS:NSE,AAPL,SPY"
    }
  }));
});

ws.on('message', function incoming(data) {
  console.log('Received:', data.toString());
  // close after first message of type price
  const parsed = JSON.parse(data.toString());
  if (parsed.event === 'price') {
      setTimeout(() => ws.close(), 1000);
  }
});
