import { BillingPeriod } from "@/types/creem";

export const formatAmount = (amount?: number): string => {
    if (amount == null) {
      return "0.00";
    }
    return [
      amount.toString().slice(0, -2),
      ".",
      amount.toString().slice(-2),
    ].join("");
  };
  
  export const formatCurrency = (currency?: string): string => {
    switch (currency) {
      case "EUR": {
        return "€";
      }
      case "USD": {
        return "$";
      }
      case "SEK": {
        return "kr";
      }
      default: {
        if (currency != null) {
          return currency;
        } else {
          return "";
        }
      }
    }
  };

  export const formatMoney = (amount?: number, currency?: string): string => {
    if (currency == "SEK") {
        return `${formatAmount(amount)} ${formatCurrency(currency)}`
    } else {
        return `${formatCurrency(currency)} ${formatAmount(amount)}`
    }
  };

  /**
   * Formats billing period codes into human-readable text
   * 
   * @param billingPeriod - The billing period code from BillingPeriod enum
   * @returns A user-friendly string representation of the billing period
   * 
   * @example
   * billingPeriodDisplay('one-m') // Returns "Monthly"
   * billingPeriodDisplay('one-y') // Returns "Yearly"
   */
  export const billingPeriodDisplay = (billingPeriod: string) => {
    switch (billingPeriod) {
      case BillingPeriod.oneMonth: {
        return "Monthly";
      }
      case BillingPeriod.threeMonths: {
        return "Every 3 Months";
      }
      case BillingPeriod.sixMonths: {
        return "Every 6 Months";
      }
      case BillingPeriod.oneYear: {
        return "Yearly";
      }
      default: {
        return "Monthly";
      }
    }
  };
  