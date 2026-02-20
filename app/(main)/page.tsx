"use cache";

import { Vote, Calendar, AlertTriangle, Users, TrendingUp, Shield, Activity, Landmark } from "lucide-react";

export default async function Home() {
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="space-y-8">
                {/* Civic Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                            <Landmark className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">City Dashboard</h1>
                            <p className="text-sm text-muted-foreground">Municipal activities and community governance at a glance.</p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:border-primary/30 transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Vote className="w-4.5 h-4.5 text-primary" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposals</span>
                        </div>
                        <div className="text-3xl font-bold text-foreground">7</div>
                        <p className="text-xs text-muted-foreground mt-1">Active governance proposals</p>
                    </div>

                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:border-blue-500/30 transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                <Calendar className="w-4.5 h-4.5 text-blue-400" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Events</span>
                        </div>
                        <div className="text-3xl font-bold text-foreground">12</div>
                        <p className="text-xs text-muted-foreground mt-1">Community events this month</p>
                    </div>

                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:border-amber-500/30 transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</span>
                        </div>
                        <div className="text-3xl font-bold text-amber-400">2</div>
                        <p className="text-xs text-muted-foreground mt-1">Items requiring attention</p>
                    </div>

                    <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:border-emerald-500/30 transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                <Users className="w-4.5 h-4.5 text-emerald-400" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Members</span>
                        </div>
                        <div className="text-3xl font-bold text-foreground">48</div>
                        <p className="text-xs text-muted-foreground mt-1">Active community members</p>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Governance Health */}
                    <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Governance Overview</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                    <Shield className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">All Systems Operational</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Majority-vote approval active across all communities</p>
                                </div>
                                <span className="ml-auto px-2.5 py-1 text-[10px] font-bold uppercase bg-primary/15 text-primary rounded-full border border-primary/20">
                                    Healthy
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                                    <div className="text-lg font-bold text-foreground">7</div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase">Open Votes</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                                    <div className="text-lg font-bold text-foreground">23</div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase">Completed</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                                    <div className="text-lg font-bold text-primary">96%</div>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase">Compliance</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Recent Activity</span>
                        </div>
                        <div className="divide-y divide-border/50">
                            <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-foreground">New proposal submitted for park renovation</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">2 hours ago</p>
                                </div>
                            </div>
                            <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-foreground">Community cleanup event created</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">5 hours ago</p>
                                </div>
                            </div>
                            <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-foreground">Budget proposal approved (12-3)</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">1 day ago</p>
                                </div>
                            </div>
                            <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs text-foreground">3 new members joined your communities</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">2 days ago</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
