
import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Ensure we can import the bridge
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the app but mock the global IB initialization to avoid connecting
with patch('ib_insync.IB'):
    import ibkr_bridge

class TestIBKRBridge(unittest.TestCase):
    def setUp(self):
        self.app = ibkr_bridge.app.test_client()
        self.app.testing = True
        
    @patch('ibkr_bridge.get_ib')
    def test_health_check_connected(self, mock_get_ib):
        mock_ib = MagicMock()
        mock_ib.isConnected.return_value = True
        mock_get_ib.return_value = mock_ib
        
        # We also need to patch the global 'ib' variable used in health endpoint's try/except block
        with patch('ibkr_bridge.ib', mock_ib):
            response = self.app.get('/health')
            data = json.loads(response.data)
            
            self.assertTrue(data['connected'])
            self.assertEqual(data['status'], 'ok')
            
    def test_health_check_disconnected(self):
        with patch('ibkr_bridge.ib', None):
            response = self.app.get('/health')
            data = json.loads(response.data)
            self.assertFalse(data['connected'])

    @patch('ibkr_bridge.get_ib')
    def test_market_data(self, mock_get_ib):
        mock_ib = MagicMock()
        mock_ib.isConnected.return_value = True
        mock_get_ib.return_value = mock_ib
        
        # Mock ticker data
        mock_ticker = MagicMock()
        mock_ticker.last = 150.0
        mock_ticker.bid = 149.9
        mock_ticker.ask = 150.1
        mock_ticker.volume = 1000
        mock_ticker.close = 148.0
        mock_ticker.high = 151.0
        mock_ticker.low = 148.0
        
        mock_ib.reqMktData.return_value = mock_ticker
        
        response = self.app.get('/market-data/AAPL')
        data = json.loads(response.data)
        
        self.assertEqual(data['symbol'], 'AAPL')
        self.assertEqual(data['last'], 150.0)
        
    @patch('ibkr_bridge.get_ib')
    def test_option_chain(self, mock_get_ib):
        mock_ib = MagicMock()
        mock_ib.isConnected.return_value = True
        mock_get_ib.return_value = mock_ib
        
        # Mock chain
        mock_chain = MagicMock()
        mock_chain.exchange = 'SMART'
        mock_chain.expirations = ['20260101', '20260201']
        mock_chain.strikes = [100.0, 110.0]
        mock_chain.multiplier = 100
        mock_ib.reqSecDefOptParams.return_value = [mock_chain]
        
        response = self.app.get('/option-chain/AAPL')
        data = json.loads(response.data)
        
        self.assertEqual(data['exchange'], 'SMART')
        self.assertEqual(len(data['expirations']), 2)
        
    @patch('ibkr_bridge.get_ib')
    def test_option_quote(self, mock_get_ib):
        mock_ib = MagicMock()
        mock_ib.isConnected.return_value = True
        mock_get_ib.return_value = mock_ib
        
        mock_ticker = MagicMock()
        mock_ticker.bid = 5.0
        mock_ticker.ask = 5.2
        # Use simple floats for last/volume to avoid Mock objects
        mock_ticker.last = 5.1
        mock_ticker.volume = 100
        mock_ticker.callOpenInterest = 1000
        mock_ticker.putOpenInterest = 1000
        
        mock_greeks = MagicMock()
        mock_greeks.delta = 0.5
        mock_greeks.gamma = 0.1
        mock_greeks.theta = -0.05
        mock_greeks.vega = 0.2
        mock_greeks.impliedVol = 0.3
        mock_greeks.undPrice = 150.0
        
        mock_ticker.modelGreeks = mock_greeks
        
        mock_ib.reqMktData.return_value = mock_ticker
        
        payload = {
            'symbol': 'AAPL',
            'strike': 150,
            'expiration': '20260101',
            'right': 'C'
        }
        
        response = self.app.post('/option-quote', 
                               data=json.dumps(payload),
                               content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(data['bid'], 5.0)
        self.assertEqual(data['delta'], 0.5)

if __name__ == '__main__':
    unittest.main()
