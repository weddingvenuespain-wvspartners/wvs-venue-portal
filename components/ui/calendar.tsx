"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "react-day-picker/dist/style.css"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4 relative",
        month_caption: "flex justify-center pt-1 items-center w-full h-9",
        caption_label: "text-sm font-medium",
        nav: "absolute right-1 top-1 z-10 flex items-center gap-1",
        button_previous: "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent text-foreground opacity-60 hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-colors disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none",
        button_next: "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent text-foreground opacity-60 hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-colors disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none",
        month_grid: "w-full border-collapse space-x-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start: "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        range_end: "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
