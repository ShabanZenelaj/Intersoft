"use client"

import { createContext, useContext, useState } from "react"

const CartContext = createContext(null)

/**
 * Client cart state seeded from the server-rendered cart. Server actions
 * return the updated cart, which is pushed back here so the badge and the
 * slide-over stay in sync without refetching.
 */
export const CartProvider = ({ initialCart, children }) => {
  const [cart, setCart] = useState(initialCart)
  const [isOpen, setIsOpen] = useState(false)

  const itemCount = (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0)

  const value = {
    cart,
    setCart,
    itemCount,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
