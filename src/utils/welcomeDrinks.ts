import { TicketPayload, Table } from "../types";

/**
 * Calculates the standard price for a drink based on promotions, discounts, and service charges.
 */
export function calculateDrinkPrice(drink: any, qty: number, isWholeStoreFree: boolean = false): number {
  if (!drink) return 0;
  if (isWholeStoreFree || drink.isFree) return 0;

  const basePrice = drink.price || 0;
  
  let paidQty = qty;
  if (drink.buyQty > 0 && drink.freeQty > 0) {
    const setSize = drink.buyQty + drink.freeQty;
    const sets = Math.floor(qty / setSize);
    const remainder = qty % setSize;
    paidQty = (sets * drink.buyQty) + Math.min(remainder, drink.buyQty);
  }
  
  let total = paidQty * basePrice;
  
  if (drink.discountPercent > 0) {
    total = total - (total * (drink.discountPercent / 100));
  }
  
  if (drink.serviceChargePercent > 0) {
    total = total + (total * (drink.serviceChargePercent / 100));
  }
  
  return total;
}

/**
 * Calculates Welcome Drink info, limits, and eligibility for a given ticket.
 */
export function getTicketWelcomeDrinksInfo(ticket: TicketPayload, config: any, tables: Table[]) {
  if (!ticket || !config || !tables) {
    return { 
      totalAllowance: 0, 
      matchingDrinks: [], 
      matchingDrinkIds: [] as string[], 
      previousRedeemed: 0, 
      remainingAllowance: 0, 
      zoneQuota: 0 
    };
  }

  const table = tables.find((t) => t.id === ticket.tableId);
  const zoneId = table?.zoneId || "";
  
  // Quota per seat
  const activeZones = config.zones || {};
  const zoneObj = activeZones[zoneId] || {};
  
  // Custom quota or fallback: VIP/A is 2, others 1
  const zoneQuota = zoneObj.welcomeDrinkQuota !== undefined 
    ? Number(zoneObj.welcomeDrinkQuota) 
    : (zoneId === 'VIP' || zoneId === 'A' ? 2 : 1);

  const numSeats = ticket.seatIds?.length || 1;
  const totalAllowance = numSeats * zoneQuota;

  // Find drinks configured as Welcome Drink for this zone or table
  const matchingDrinks = (config.drinks || []).filter((drink: any) => {
    if (!drink.isWelcomeDrink) return false;
    
    const welcomeZones = Array.isArray(drink.welcomeZones) ? drink.welcomeZones : [];
    const welcomeTables = Array.isArray(drink.welcomeTables) ? drink.welcomeTables : [];
    
    const zoneMatch = welcomeZones.includes(zoneId);
    const tableMatch = welcomeTables.includes(ticket.tableId);
    
    return zoneMatch || tableMatch;
  });

  const matchingDrinkIds = matchingDrinks.map((d: any) => d.id);

  // Calculate previously redeemed matching welcome drinks
  let previousRedeemed = 0;
  if (ticket.drinkHistory) {
    Object.entries(ticket.drinkHistory).forEach(([dId, qty]) => {
      if (matchingDrinkIds.includes(dId)) {
        previousRedeemed += Number(qty);
      }
    });
  }

  const remainingAllowance = Math.max(0, totalAllowance - previousRedeemed);

  return {
    totalAllowance,
    matchingDrinks,
    matchingDrinkIds,
    previousRedeemed,
    remainingAllowance,
    zoneQuota
  };
}

/**
 * Calculates the cost of drinks currently in the cart, applying free Welcome Drink quotas.
 * Prioritizes applying the free quota to the most expensive matching drinks first.
 */
export function calculateCartPriceWithWelcomeDrinks(
  cart: Record<string, number>,
  ticket: TicketPayload,
  config: any,
  tables: Table[]
) {
  const info = getTicketWelcomeDrinksInfo(ticket, config, tables);
  let remainingFreeQuota = info.remainingAllowance;

  let totalCost = 0;
  const itemBreakdown: Record<string, { totalQty: number; freeQty: number; paidQty: number; price: number }> = {};

  // Sort cart entries by drink price in descending order to maximize benefit
  const sortedCartEntries = Object.entries(cart).sort(([idA], [idB]) => {
    const dA = config.drinks?.find((x: any) => x.id === idA);
    const dB = config.drinks?.find((x: any) => x.id === idB);
    const priceA = dA?.price || 0;
    const priceB = dB?.price || 0;
    return priceB - priceA;
  });

  sortedCartEntries.forEach(([dId, qty]) => {
    const d = config.drinks?.find((x: any) => x.id === dId);
    if (!d) return;

    let freeCount = 0;
    if (info.matchingDrinkIds.includes(dId) && remainingFreeQuota > 0) {
      freeCount = Math.min(qty, remainingFreeQuota);
      remainingFreeQuota -= freeCount;
    }

    const paidCount = qty - freeCount;
    let paidPrice = 0;
    if (paidCount > 0) {
      paidPrice = calculateDrinkPrice(d, paidCount, config.isWholeStoreFree);
    }

    totalCost += paidPrice;
    itemBreakdown[dId] = {
      totalQty: qty,
      freeQty: freeCount,
      paidQty: paidCount,
      price: paidPrice
    };
  });

  return { totalCost, itemBreakdown, info };
}

/**
 * Calculates the total drink revenue for a finished ticket, accounting for free Welcome Drinks.
 */
export function calculateTicketDrinkRevenue(
  ticket: TicketPayload,
  config: any,
  tables: Table[]
): number {
  if (!ticket.drinkHistory || Object.keys(ticket.drinkHistory).length === 0) return 0;

  const info = getTicketWelcomeDrinksInfo(ticket, config, tables);
  let remainingFreeQuota = info.totalAllowance;

  // Sort redeemed items by price descending
  const sortedRedeemed = Object.entries(ticket.drinkHistory).sort(([idA], [idB]) => {
    const dA = config.drinks?.find((x: any) => x.id === idA);
    const dB = config.drinks?.find((x: any) => x.id === idB);
    const priceA = dA?.price || 0;
    const priceB = dB?.price || 0;
    return priceB - priceA;
  });

  let ticketRevenue = 0;

  sortedRedeemed.forEach(([dId, qty]) => {
    const d = config.drinks?.find((x: any) => x.id === dId);
    if (!d) return;

    let freeCount = 0;
    if (info.matchingDrinkIds.includes(dId) && remainingFreeQuota > 0) {
      freeCount = Math.min(Number(qty), remainingFreeQuota);
      remainingFreeQuota -= freeCount;
    }

    const paidCount = Number(qty) - freeCount;
    if (paidCount > 0) {
      ticketRevenue += calculateDrinkPrice(d, paidCount, config.isWholeStoreFree);
    }
  });

  return ticketRevenue;
}
