import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetStats,
  getGetStatsQueryKey,
  useListImages,
  getListImagesQueryKey,
  useClearDatabase,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import {
  Database,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Cpu,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export default function DatabasePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: imagesData, isLoading: imagesLoading } = useListImages();

  const clearMutation = useClearDatabase();

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json() as { count?: number };
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
      toast({
        title: "Images Indexed",
        description: `Successfully added ${data.count ?? files.length} image(s) to the database.`,
      });
    } catch {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading the images.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
        toast({
          title: "Database Cleared",
          description: "All indexed images have been removed.",
        });
      },
      onError: () => {
        toast({
          title: "Clear Failed",
          description: "Could not clear the database.",
          variant: "destructive",
        });
      },
    });
  };

  const images = imagesData?.images || [];

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                Database Management
              </h1>
              <p className="text-muted-foreground text-lg">
                Monitor and manage your indexed image collection.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: getGetStatsQueryKey(),
                  });
                  queryClient.invalidateQueries({
                    queryKey: getListImagesQueryKey(),
                  });
                }}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Clear Database
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      Clear all images?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      all indexed images from the database and remove their
                      vector embeddings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClear}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </header>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 flex items-start gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Images
                </p>
                <h3 className="text-3xl font-bold font-mono mt-1">
                  {statsLoading ? "..." : stats?.totalImages || 0}
                </h3>
              </div>
            </Card>

            <Card className="p-6 flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  FAISS Index
                </p>
                <div className="mt-2">
                  {statsLoading ? (
                    "..."
                  ) : stats?.indexLoaded ? (
                    <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">
                      Loaded Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20"
                    >
                      Offline
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6 flex items-start gap-4">
              <div className="p-3 bg-purple-500/10 text-purple-500 rounded-lg">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ML Model
                </p>
                <div className="mt-2">
                  {statsLoading ? (
                    "..."
                  ) : stats?.modelLoaded ? (
                    <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">
                      CLIP Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20"
                    >
                      Offline
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-1">Add to Index</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select one or more images to compute their embeddings and add
                  them to the FAISS search index.
                </p>
                <ImageUpload
                  onUpload={handleUpload}
                  isUploading={isUploading}
                  multiple={true}
                  text="Upload images to database"
                  className="h-48"
                />
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="p-5 h-full min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Indexed Images
                  </h3>
                  <Badge variant="outline" className="font-mono">
                    {images.length} entries
                  </Badge>
                </div>

                {imagesLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : images.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/10">
                    <Database className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">
                      Index is empty
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Upload images to start building your search database.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto pr-2 pb-2">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="group relative aspect-square rounded-md overflow-hidden bg-muted border border-border"
                      >
                        <img
                          src={`/api/images/${img.id}`}
                          alt={img.filename}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                          <p className="text-[10px] text-white truncate text-center break-all">
                            {img.filename}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
