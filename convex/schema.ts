
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(), // Links to BetterAuth user ID
    name: v.string(),
    city: v.object({
      name: v.string(),
      country: v.string(),
      state: v.optional(v.string()),
      lat: v.number(),
      lon: v.number(),
    }),
    bio: v.optional(v.string()),
    interests: v.array(v.string()),
    imageUrl: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"]),

  groups: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    city: v.object({
      name: v.string(),
      country: v.string(),
      state: v.optional(v.string()),
      lat: v.number(),
      lon: v.number(),
    }),
    coverImageId: v.optional(v.id("_storage")),
    createdBy: v.string(), // userId
    isPublic: v.boolean(),
  })
    .index("by_city", ["city.name"])
    .index("by_category", ["category"])
    .index("by_createdBy", ["createdBy"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.string(),
    role: v.string(), // "manager" | "member"
    joinedAt: v.number(), // timestamp
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"])
    .index("by_group_role", ["groupId", "role"]),

  events: defineTable({
    groupId: v.id("groups"),
    title: v.string(),
    description: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    location: v.string(),
    locationCoords: v.optional(v.object({
      lat: v.number(),
      lon: v.number(),
    })),
    eventType: v.union(v.literal("online"), v.literal("in-person")),
    category: v.optional(v.string()), // mirrors group category or custom
    attendees: v.array(v.string()), // userIds
    isPaid: v.optional(v.boolean()),
    price: v.optional(v.number()),
    capacity: v.optional(v.number()),
    refundPolicy: v.optional(v.string()),
    status: v.optional(v.string()), // "upcoming" | "ongoing" | "completed" | "cancelled"
    photoIds: v.optional(v.array(v.id("_storage"))),
    coverImageId: v.optional(v.id("_storage")),
    createdBy: v.optional(v.string()),
  })
    .index("by_group", ["groupId"])
    .index("by_startTime", ["startTime"]),

  eventPhotos: defineTable({
    eventId: v.id("events"),
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
    caption: v.optional(v.string()),
    type: v.optional(v.string()), // "memory" | "live" | "promo" — defaults to "memory"
    needsApproval: v.optional(v.boolean()), // true if uploaded after 7-day window (needs manager approval)
    approved: v.optional(v.boolean()), // null/undefined = auto-approved, false = pending, true = approved
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"]),

  groupInvites: defineTable({
    groupId: v.id("groups"),
    token: v.string(),
    createdBy: v.string(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
    uses: v.number(), // Track usage
  })
    .index("by_token", ["token"])
    .index("by_group", ["groupId"]),

  joinRequests: defineTable({
    groupId: v.id("groups"),
    userId: v.string(),
    status: v.string(), // "pending" | "approved" | "rejected" | "voting"
    message: v.optional(v.string()),
    requiredVotes: v.optional(v.number()),   // majority threshold
    resolvedAt: v.optional(v.number()),      // resolution timestamp
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),

  votes: defineTable({
    requestId: v.id("joinRequests"),
    groupId: v.id("groups"),
    voterId: v.string(),        // manager userId
    vote: v.union(v.literal("approve"), v.literal("reject")),
    castAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_request_voter", ["requestId", "voterId"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.string(), // "join_request" | "join_result" | "mention" | "payment_success" | "new_message" | "poll_created" | "governance_alert" | "fund_goal" | "member_joined" | "member_left" | "event_created" | "photo_uploaded" | "reaction"
    layer: v.optional(v.string()), // "critical" | "important" | "passive" — optional for backwards compat with old docs
    title: v.optional(v.string()), // optional for backwards compat with old docs
    message: v.string(),
    icon: v.optional(v.string()), // "governance" | "message" | "vote" | "event" | "payment" | "member" | "poll" | "photo"
    data: v.optional(v.any()), // flexible data payload (groupId, requestId, channelId, messageId, etc.)
    groupId: v.optional(v.id("groups")), // for grouping notifications
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "isRead"])
    .index("by_user_created", ["userId", "createdAt"]),

  // User notification preferences (quiet hours, mutes)
  notificationPreferences: defineTable({
    userId: v.string(),
    webNotificationsEnabled: v.boolean(),
    quietHoursEnabled: v.boolean(),
    quietHoursStart: v.optional(v.number()), // hour 0-23
    quietHoursEnd: v.optional(v.number()),   // hour 0-23
    mutedGroupIds: v.optional(v.array(v.id("groups"))),
    mutedChannelIds: v.optional(v.array(v.id("channels"))),
  })
    .index("by_userId", ["userId"]),

  // Push subscription for web notifications
  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  governanceLogs: defineTable({
    groupId: v.id("groups"),
    actionType: v.string(), // "promotion", "demotion", "removal", "vote_resolution", "rule_violation"
    actorId: v.string(), // userId of who performed the action
    targetUserId: v.optional(v.string()), // userId of who was affected
    requestId: v.optional(v.id("joinRequests")), // linked request if applicable
    details: v.optional(v.string()), // human readable summary or metadata
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_actor", ["actorId"])
    .index("by_target", ["targetUserId"]),

  // Democratic action proposals (demote, kick, etc. require majority vote)
  governanceProposals: defineTable({
    groupId: v.id("groups"),
    actionType: v.string(), // "demote" | "kick"
    proposerId: v.string(), // who proposed
    targetUserId: v.string(), // who is being acted upon
    reason: v.optional(v.string()),
    status: v.string(), // "voting" | "approved" | "rejected" | "expired"
    requiredVotes: v.number(), // majority threshold
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_group_status", ["groupId", "status"]),

  proposalVotes: defineTable({
    proposalId: v.id("governanceProposals"),
    voterId: v.string(),
    vote: v.union(v.literal("approve"), v.literal("reject")),
    castAt: v.number(),
  })
    .index("by_proposal", ["proposalId"])
    .index("by_proposal_voter", ["proposalId", "voterId"]),

  // ─── Feature 6: Structured Communication (Chat) ───
  channels: defineTable({
    groupId: v.id("groups"),
    name: v.string(),
    type: v.union(v.literal("default"), v.literal("custom")),
    purpose: v.optional(v.string()), // e.g. "Announcements", "General"
    isManagerOnlyPost: v.boolean(),
    createdBy: v.string(), // userId or "system"
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    groupId: v.id("groups"), // Denormalized for easier access control
    userId: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("file"),
      v.literal("poll"),
      v.literal("voice"),
      v.literal("system")
    ),
    pollId: v.optional(v.id("polls")),
    fileId: v.optional(v.id("_storage")),
    mentions: v.optional(v.array(v.string())), // userIds mentioned in the message
    reactions: v.optional(v.array(v.object({
      emoji: v.string(),
      users: v.array(v.string()), // userIds who reacted
    }))),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    parentMessageId: v.optional(v.id("messages")), // For replies
    clientSideId: v.optional(v.string()), // For optimistic update syncing
    // Voice transcription
    transcription: v.optional(v.string()),
    transcriptionStatus: v.optional(v.string()), // "pending" | "completed" | "failed"
    // Moderation fields
    isFlagged: v.optional(v.boolean()),
    moderationStatus: v.optional(v.string()), // "flagged" | "hidden" | "cleared"
  })
    .index("by_channel", ["channelId", "createdAt"])
    .index("by_group", ["groupId"]),

  channelSubscriptions: defineTable({
    userId: v.string(),
    channelId: v.id("channels"),
    groupId: v.id("groups"),
    isMuted: v.boolean(),
    lastReadAt: v.number(),
  })
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_channel", ["channelId"])
    .index("by_user_group", ["userId", "groupId"]),

  polls: defineTable({
    channelId: v.id("channels"),
    groupId: v.id("groups"),
    question: v.string(),
    pollType: v.optional(v.string()), // "single_choice" | "multiple_choice" | "yes_no" | "rating" | "feedback"
    options: v.array(v.object({ label: v.string(), count: v.number() })),
    isAnonymous: v.optional(v.boolean()),
    allowMultiple: v.optional(v.boolean()),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_group", ["groupId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.string(),
    optionIndex: v.optional(v.number()),
    optionIndices: v.optional(v.array(v.number())),
    rating: v.optional(v.number()),
    textResponse: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_poll_user", ["pollId", "userId"])
    .index("by_poll", ["pollId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.string(),
    userName: v.string(),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),

  presence: defineTable({
    groupId: v.id("groups"),
    userId: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"]),

  userPresence: defineTable({
    userId: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  eventPayments: defineTable({
    eventId: v.id("events"),
    userId: v.string(),
    paymentId: v.optional(v.string()), // Razorpay Payment ID
    orderId: v.string(), // Razorpay Order ID
    signature: v.optional(v.string()), // Razorpay Signature
    amount: v.number(),
    status: v.string(), // "created", "paid", "failed"
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"]),

  groupFunds: defineTable({
    groupId: v.id("groups"),
    title: v.string(),
    description: v.string(),
    targetAmount: v.number(),
    currentAmount: v.number(),
    createdBy: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"]),

  fundContributions: defineTable({
    fundId: v.id("groupFunds"),
    userId: v.string(),
    paymentId: v.optional(v.string()), // Razorpay Payment ID
    orderId: v.string(), // Razorpay Order ID
    signature: v.optional(v.string()), // Razorpay Signature
    amount: v.number(),
    createdAt: v.number(),
  })
    .index("by_fund", ["fundId"])
    .index("by_user", ["userId"]),

  // ─── AI: Semantic Search Embeddings ───
  groupEmbeddings: defineTable({
    groupId: v.id("groups"),
    text: v.string(), // Combined text used for embedding
    embedding: v.array(v.float64()),
  })
    .index("by_groupId", ["groupId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: [],
    }),

  eventEmbeddings: defineTable({
    eventId: v.id("events"),
    groupId: v.id("groups"),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_eventId", ["eventId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: [],
    }),

  // ─── AI Moderation ───
  moderationFlags: defineTable({
    messageId: v.id("messages"),
    channelId: v.id("channels"),
    groupId: v.id("groups"),
    flaggedUserId: v.string(),
    category: v.string(), // "toxic" | "hate_speech" | "harassment" | "spam" | "threat" | "sexual"
    severity: v.string(), // "low" | "medium" | "high"
    confidence: v.number(), // 0-1
    reason: v.string(),
    status: v.string(), // "flagged" | "auto_hidden" | "dismissed" | "confirmed_hidden" | "approved"
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_message", ["messageId"])
    .index("by_status", ["groupId", "status"]),
});
