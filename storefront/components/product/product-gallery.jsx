"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

export const ProductGallery = ({ images = [], title }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[activeIndex] || images[0]

  return (
    <div className="flex flex-col gap-4 md:col-span-7">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary/20">
        {active && (
          <Image
            src={active.url}
            alt={title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {images.map((image, index) => (
            <button
              key={image.id || index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                index === activeIndex ? "border-black" : "border-transparent hover:border-black/30"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
