declare const _exports: mongoose.Model<{
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}> & {
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}, {
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}>> & mongoose.FlatRecord<{
    name: string;
    version: number;
    status: string;
    metadata: any;
    location: string;
    userId: mongoose.Types.ObjectId;
    notes: mongoose.Types.DocumentArray<{
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        text: string;
        createdAt: NativeDate;
        authorName: string;
        createdBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    phone: string;
    isSharedFromSingleUser: boolean;
    sharedByUserName: string;
    assignedToName: string;
    assignedManagerName: string;
    distributionStrategy: string;
    visibilityMode: "shared" | "isolated";
    primarySource: "manual" | "SOURCE_A_MANUAL" | "SOURCE_B_SIGNUP" | "SOURCE_C_ADS" | "signup" | "ads" | "webhook";
    project: string;
    tags: string[];
    service_required: "free" | "enterprise" | "team_starter" | "starter" | "growth" | "pro" | "basic_solo" | "smart_solo" | "power_solo" | "business" | "custom_enterprise" | "digital_marketing" | "web_development" | "seo_optimization" | "crm_automation" | "branding_design" | "cloud_infrastructure";
    monthly_spend: number;
    goal_timeline: "immediate" | "within_1_month" | "1_to_3_months" | "3_to_6_months" | "flexible";
    payable_amount: number;
    paid_amount: number;
    propertyType: string;
    budget: string;
    profession: string;
    areasOfInterest: string[];
    customData: any;
    children: mongoose.Types.DocumentArray<{
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }> & {
        status: string;
        createdAt: NativeDate;
        notes: string;
        customData: any;
        childName: string;
        gradeApplied: string;
        previousSchool: string;
        transportRequired: boolean;
        age?: number | null | undefined;
        dob?: NativeDate | null | undefined;
        gender?: "male" | "female" | "other" | null | undefined;
    }>;
    followUpNote: string;
    followUpStatus: "none" | "scheduled" | "due" | "completed";
    followUpDelayCount: number;
    followUpNotified: boolean;
    leadActivities: mongoose.Types.DocumentArray<{
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }> & {
        timestamp: NativeDate;
        details: string;
        action: "lead_created" | "status_changed" | "assigned_agent" | "site_visit_scheduled" | "site_visit_completed" | "note_added" | "message_sent" | "message_received" | "recording_added" | "project_linked" | "lead_updated" | "call_initiated" | "followup_scheduled" | "followup_completed" | "followup_postponed" | "stall_locked" | "event_pass";
        performerName: string;
        performedBy?: mongoose.Types.ObjectId | null | undefined;
    }>;
    editHistory: mongoose.Types.DocumentArray<{
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }> & {
        updatedAt: NativeDate;
        updatedBy: mongoose.Types.ObjectId;
        changes?: Map<string, any> | null | undefined;
    }>;
    templateUsageCount: number;
    messageSentCount: number;
    source: "api" | "meta" | "facebook" | "manual" | "signup" | "webhook" | "other" | "google" | "instagram" | "google_ads" | "meta_ads" | "website" | "organic" | "referral" | "partner" | "import" | "spreadsheet" | "agent_manual" | "platform_registration" | "auto-signup" | "meta_webhook" | "google_webhook";
    utmCampaign: string;
    utmMedium: string;
    utmSource: string;
    lostReason: string;
    lostReasonDetail: string;
    ownershipStatus: "unclaimed" | "claimed" | "assigned" | "transferred" | "released";
    email?: string | null | undefined;
    companyId?: mongoose.Types.ObjectId | null | undefined;
    sharedWithCompanyId?: mongoose.Types.ObjectId | null | undefined;
    assignedTo?: mongoose.Types.ObjectId | null | undefined;
    assignedManager?: mongoose.Types.ObjectId | null | undefined;
    distributionRuleId?: mongoose.Types.ObjectId | null | undefined;
    projectId?: mongoose.Types.ObjectId | null | undefined;
    company?: string | null | undefined;
    selected_plan_id?: string | null | undefined;
    payment_method?: string | null | undefined;
    deletedAt?: NativeDate | null | undefined;
    closedDealAmount?: number | null | undefined;
    siteVisitDate?: NativeDate | null | undefined;
    activeFollowUp?: {
        status: "none" | "scheduled" | "due" | "completed";
        note: string;
        delayCount: number;
        delayHistory: mongoose.Types.DocumentArray<{
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }> & {
            reason: string;
            delayedAt: NativeDate;
            delayedUntil: NativeDate;
            delayMinutes: number;
            performedBy?: mongoose.Types.ObjectId | null | undefined;
        }>;
        completionNote: string;
        completedAt?: NativeDate | null | undefined;
        scheduledAt?: NativeDate | null | undefined;
        lastRungAt?: NativeDate | null | undefined;
        completedBy?: mongoose.Types.ObjectId | null | undefined;
    } | null | undefined;
    followUpDate?: NativeDate | null | undefined;
    lastContactedAt?: NativeDate | null | undefined;
    leadSource?: {
        provider: string;
        externalLeadId: string;
        formName: string;
        campaignName: string;
        adSetName: string;
        adGroupName: string;
        adName: string;
        integrationId?: mongoose.Types.ObjectId | null | undefined;
        accountId?: string | null | undefined;
        pageId?: string | null | undefined;
        formId?: string | null | undefined;
        campaignId?: string | null | undefined;
        adSetId?: string | null | undefined;
        adGroupId?: string | null | undefined;
        adId?: string | null | undefined;
        importedAt?: NativeDate | null | undefined;
    } | null | undefined;
    currentOwnerId?: mongoose.Types.ObjectId | null | undefined;
    claimedAt?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
export = _exports;
import mongoose = require("mongoose");
