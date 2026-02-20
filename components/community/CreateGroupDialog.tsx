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
import { Separator } from "@/components/ui/separator";
import { CityPicker } from "@/components/CityPicker";
import { cn } from "@/lib/utils";
import {
    Loader2,
    Camera,
    Users,
    X,
    Plus,
    Globe,
    Lock,
} from "lucide-react";

interface City {
    name: string;
    country: string;
    state?: string;
    lat: number;
    lon: number;
}

const CATEGORIES = [
    "Neighborhood",
    "Environment",
    "Education",
    "Arts & Culture",
    "Sports & Recreation",
    "Safety & Watch",
    "Local Business",
    "Tech & Innovation",
    "Health & Wellness",
    "Other",
];

interface CreateGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
    const createGroup = useMutation(api.groups.createGroup);
    const generateUploadUrl = useMutation(api.groups.generateUploadUrl);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [city, setCity] = useState<City | null>(null);
    const [isPublic, setIsPublic] = useState(true);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addTag = () => {
        const trimmed = tagInput.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
            setTags([...tags, trimmed]);
            setTagInput("");
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setCategory("");
        setTags([]);
        setTagInput("");
        setCity(null);
        setIsPublic(true);
        setCoverFile(null);
        setCoverPreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Group name is required");
        if (!category) return toast.error("Select a category");
        if (!city) return toast.error("Select a city");
        if (!description.trim()) return toast.error("Add a description");

        setIsSubmitting(true);
        try {
            let coverImageId: any = undefined;
            if (coverFile) {
                const uploadUrl = await generateUploadUrl();
                const result = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": coverFile.type },
                    body: coverFile,
                });
                const { storageId } = await result.json();
                coverImageId = storageId;
            }

            await createGroup({
                name: name.trim(),
                description: description.trim(),
                category,
                tags,
                city: {
                    name: city.name,
                    country: city.country,
                    state: city.state,
                    lat: city.lat,
                    lon: city.lon,
                },
                isPublic,
                ...(coverImageId && { coverImageId }),
            });

            toast.success("Group created! You're now the manager.");
            resetForm();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle className="text-xl font-semibold">
                        Create a Group
                    </DialogTitle>
                </DialogHeader>

                <Separator className="shrink-0" />

                <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
                    <div className="space-y-6">
                        {/* Cover Image */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Cover Image</Label>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-full h-32 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center overflow-hidden group border-2 border-dashed border-border hover:border-primary/40"
                            >
                                {coverPreview ? (
                                    <img
                                        src={coverPreview}
                                        alt="Cover preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Camera className="w-6 h-6" />
                                        <span className="text-xs">Click to upload cover</span>
                                    </div>
                                )}
                                {coverPreview && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleCoverChange}
                                className="hidden"
                            />
                        </div>

                        <Separator />

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="group-name" className="text-sm font-medium">
                                Group Name
                            </Label>
                            <Input
                                id="group-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Downtown Cyclists Club"
                                required
                                className="h-10"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="group-desc" className="text-sm font-medium">
                                Description
                            </Label>
                            <Textarea
                                id="group-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this group about? What will members do?"
                                className="resize-none min-h-25"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Category</Label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                            category === cat
                                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* City */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">City</Label>
                            <CityPicker
                                value={city}
                                onChange={setCity}
                                placeholder="Search for a city..."
                            />
                        </div>

                        <Separator />

                        {/* Visibility */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">Visibility</Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {isPublic
                                            ? "Anyone can discover and join this group"
                                            : "Members must request to join"}
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
                                        <Globe className="w-3.5 h-3.5" />
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
                                        <Lock className="w-3.5 h-3.5" />
                                        Private
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Tags */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                Tags <span className="text-muted-foreground font-normal text-xs">(up to 5)</span>
                            </Label>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                        >
                                            #{tag}
                                            <button
                                                type="button"
                                                onClick={() => setTags(tags.filter((t) => t !== tag))}
                                                className="hover:text-destructive transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addTag();
                                        }
                                    }}
                                    placeholder="Add a tag..."
                                    className="flex-1 h-9 text-sm"
                                    disabled={tags.length >= 5}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={addTag}
                                    disabled={!tagInput.trim() || tags.length >= 5}
                                    className="h-9 w-9"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="shrink-0" />

                {/* Footer */}
                <div className="px-6 py-4 shrink-0 bg-background">
                    <div className="flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                resetForm();
                                onOpenChange(false);
                            }}
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
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Users className="w-4 h-4 mr-2" />
                                    Create Group
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
