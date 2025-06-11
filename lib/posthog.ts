import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  })
}

export default posthogClient 