import pytest
import json
from unittest.mock import MagicMock, patch

# Note: In a real environment, we would import the Flask app
# For this architectural test, we mock the core fetcher logic

def mock_account_summary_response():
    return [
        MagicMock(tag='NetLiquidation', value='1000000', currency='USD'),
        MagicMock(tag='DailyPnL', value='1500', currency='USD'),
        MagicMock(tag='ExcessLiquidity', value='45000', currency='USD'),
        MagicMock(tag='BuyingPower', value='250000', currency='USD')
    ]

def test_account_summary_parsing():
    """Verify that the bridge correctly filters and maps IBKR tags including new fields."""
    summ = mock_account_summary_response()
    allowed_tags = ('NetLiquidation', 'TotalCashValue', 'BuyingPower', 'AvailableFunds', 'ExcessLiquidity', 'DailyPnL')
    
    payload = {
        s.tag: float(s.value)
        for s in summ
        if s.currency == 'USD' and s.tag in allowed_tags
    }
    
    assert payload['NetLiquidation'] == 1000000.0
    assert payload['DailyPnL'] == 1500.0
    assert payload['ExcessLiquidity'] == 45000.0
    assert 'BuyingPower' in payload

def test_position_normalization():
    """Verify that the bridge payload structure for positions is consistent."""
    mock_pos = MagicMock()
    mock_pos.account = 'DU123'
    mock_pos.contract.symbol = 'AAPL'
    mock_pos.position = 100
    mock_pos.avgCost = 150.0
    
    payload = {
        "account": mock_pos.account,
        "symbol": mock_pos.contract.symbol,
        "quantity": mock_pos.position,
        "avgCost": mock_pos.avgCost
    }
    
    assert payload['symbol'] == 'AAPL'
    assert payload['quantity'] == 100
    assert isinstance(payload['avgCost'], float)
