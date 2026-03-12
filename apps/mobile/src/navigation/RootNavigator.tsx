import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RegisterScreen } from '../screens/register/RegisterScreen';
import { TenderSelectionScreen } from '../screens/checkout/TenderSelectionScreen';
import { CashTenderScreen } from '../screens/checkout/CashTenderScreen';
import { CryptoQRInvoiceScreen } from '../screens/checkout/CryptoQRInvoiceScreen';
import { StripePaymentScreen } from '../screens/checkout/StripePaymentScreen';
import { ReceiptScreen } from '../screens/checkout/ReceiptScreen';
import { CloseRegisterScreen } from '../screens/manager/CloseRegisterScreen';

export type RootStackParamList = {
  Register: undefined;
  TenderSelection: { amountCents: number };
  CashTender: { amountCents: number };
  CryptoQRInvoice: { saleId: string; amountCents: number; currency: 'ETH' | 'BTC' | 'USDC' };
  StripePayment: { amountCents: number; saleId: string };
  Receipt: { saleId: string };
  CloseRegister: undefined;
  ManagerOverride: { action: string; onApproved: () => void };
};

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Register"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="TenderSelection"
        component={TenderSelectionScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="CashTender"
        component={CashTenderScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="CryptoQRInvoice"
        component={CryptoQRInvoiceScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="StripePayment"
        component={StripePaymentScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Receipt"
        component={ReceiptScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="CloseRegister"
        component={CloseRegisterScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
