import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

const NotFound = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 text-center">
    <h1 className="text-6xl font-bold">404</h1>
    <p className="text-lg text-muted-foreground">This page could not be found.</p>
    <Link href="/" className={buttonVariants()}>
      Back to home
    </Link>
  </div>
)

export default NotFound
