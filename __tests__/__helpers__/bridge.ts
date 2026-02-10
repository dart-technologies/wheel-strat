import { success, failure } from '@wheel-strat/shared';
import * as tradingService from '@/services/trading';

/**
 * Mocks the placeOrder response from the IBKR bridge.
 */
export const mockPlaceOrderSuccess = (orderId: number = 12345) => {
    jest.spyOn(tradingService, 'placeOrder').mockResolvedValue(
        success({
            orderId,
            status: 'Submitted',
            message: 'Order accepted'
        })
    );
};

export const mockPlaceOrderFailure = (errorMessage: string = 'Bridge timeout') => {
    jest.spyOn(tradingService, 'placeOrder').mockResolvedValue(
        failure(new Error(errorMessage))
    );
};

/**
 * Mocks the fetchExecutions response.
 */
export const mockExecutions = (trades: any[]) => {
    jest.spyOn(tradingService, 'fetchExecutions').mockResolvedValue(
        success(trades)
    );
};
