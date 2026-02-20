"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, User, X, Plus, Sparkles, Eye, EyeOff } from "lucide-react";
import { CityPicker } from "@/components/CityPicker";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

interface City {
    name: string;
    country: string;
    state?: string;
    lat: number;
    lon: number;
}

interface EditProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentProfile: {
        name: string;
        city: City;
        bio?: string;
        interests: string[];
        imageUrl?: string;
        isPublic: boolean;
    };
    currentAvatarUrl?: string | null;
}

const INTERESTS = [
    "Urban Planning",
    "Sustainability",
    "Public Transit",
    "Cycling",
    "Arts & Culture",
    "Education",
    "Tech & Innovation",
    "Community Safety",
    "Housing",
    "Parks & Green Spaces",
    "Local Business",
    "Public Health",
];

export function EditProfileDialog({
    open,
    onOpenChange,
    currentProfile,
    currentAvatarUrl,
}: EditProfileDialogProps) {
    const updateProfile = useMutation(api.users.updateProfile);
    const generateUploadUrl = useMutation(api.users.generateUploadUrl);

    const [name, setName] = useState(currentProfile.name);
    const [city, setCity] = useState<City | null>(currentProfile.city);
    const [bio, setBio] = useState(currentProfile.bio || "");
    const [interests, setInterests] = useState<string[]>(
        currentProfile.interests
    );
    const [isPublic, setIsPublic] = useState(currentProfile.isPublic);
    const [customInterest, setCustomInterest] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleInterest = (interest: string) => {
        setInterests((prev) =>
            prev.includes(interest)
                ? prev.filter((i) => i !== interest)
                : [...prev, interest]
        );
    };

    const addCustomInterest = () => {
        const trimmed = customInterest.trim();
        if (trimmed && !interests.includes(trimmed)) {
            setInterests([...interests, trimmed]);
            setCustomInterest("");
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!city) {
            toast.error("Please select your city");
            return;
        }
        if (interests.length === 0) {
            toast.error("Pick at least one interest");
            return;
        }

        setIsSubmitting(true);
        try {
            let imageUrl: string | undefined;

            if (avatarFile) {
                const uploadUrl = await generateUploadUrl();
                const result = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": avatarFile.type },
                    body: avatarFile,
                });
                const { storageId } = await result.json();
                imageUrl = storageId;
            }

            await updateProfile({
                name,
                city: {
                    name: city.name,
                    country: city.country,
                    state: city.state,
                    lat: city.lat,
                    lon: city.lon,
                },
                bio: bio.trim() || undefined,
                interests,
                isPublic,
                ...(imageUrl && { imageUrl }),
            });

            // Sync name to BetterAuth user table if changed
            if (name !== currentProfile.name) {
                await authClient.updateUser({ name });
            }

            toast.success("Profile updated successfully!");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update profile. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle className="text-xl font-semibold">
                        Edit Profile
                    </DialogTitle>
                </DialogHeader>

                <Separator className="shrink-0" />

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
                    <div className="space-y-6">
                        {/* Avatar Section */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                Profile photo
                            </Label>
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative w-20 h-20 rounded-full bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center overflow-hidden group ring-2 ring-border"
                                >
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : currentAvatarUrl ? (
                                        <img
                                            src={currentAvatarUrl}
                                            alt="Current avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-8 h-8 text-muted-foreground" />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                        <Camera className="w-5 h-5 text-white" />
                                    </div>
                                </button>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {avatarPreview
                                            ? "New photo selected"
                                            : "Change photo"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        JPG, PNG under 5MB
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-sm font-medium">
                                Name
                            </Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your full name"
                                required
                                className="h-10"
                            />
                        </div>

                        {/* City */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">City</Label>
                            <CityPicker
                                value={city}
                                onChange={setCity}
                                placeholder="Search for your city..."
                            />
                        </div>

                        {/* Bio */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-bio" className="text-sm font-medium">
                                Bio{" "}
                                <span className="text-muted-foreground font-normal text-xs">
                                    (optional)
                                </span>
                            </Label>
                            <Textarea
                                id="edit-bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="What drives you? What do you want to improve in your city?"
                                className="resize-none min-h-25"
                            />
                        </div>

                        <Separator />

                        {/* Profile Visibility */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">
                                        Profile Visibility
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {isPublic
                                            ? "Your profile is visible to all users"
                                            : "Your profile is hidden from others"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 bg-muted rounded-full p-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsPublic(true)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                            isPublic
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Public
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsPublic(false)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                            !isPublic
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        Private
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Interests */}
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Interests
                            </Label>

                            <div className="flex flex-wrap gap-2">
                                {INTERESTS.map((interest) => {
                                    const selected = interests.includes(interest);
                                    return (
                                        <button
                                            key={interest}
                                            type="button"
                                            onClick={() => toggleInterest(interest)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                selected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                            )}
                                        >
                                            {interest}
                                        </button>
                                    );
                                })}

                                {interests
                                    .filter((i) => !INTERESTS.includes(i))
                                    .map((interest) => (
                                        <button
                                            key={interest}
                                            type="button"
                                            onClick={() => toggleInterest(interest)}
                                            className="px-3 py-1.5 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary shadow-sm transition-all flex items-center gap-1.5"
                                        >
                                            {interest}
                                            <X className="w-3 h-3" />
                                        </button>
                                    ))}
                            </div>

                            {/* Add Custom Interest */}
                            <div className="flex gap-2 pt-2">
                                <Input
                                    value={customInterest}
                                    onChange={(e) =>
                                        setCustomInterest(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addCustomInterest();
                                        }
                                    }}
                                    placeholder="Add custom interest..."
                                    className="flex-1 h-9 text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={addCustomInterest}
                                    disabled={!customInterest.trim()}
                                    className="h-9 w-9"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="shrink-0" />

                {/* Sticky Footer */}
                <div className="px-6 py-4 shrink-0 bg-background">
                    <div className="flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="min-w-28"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
