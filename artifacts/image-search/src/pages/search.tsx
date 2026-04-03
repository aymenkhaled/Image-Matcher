import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { ImageUpload } from "@/components/image-upload";
import { useSearchImages } from "@workspace/api-client-react";
import { SearchResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Info, ImageIcon, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD_LABELS: Record<number, string> = {
  90: "Nearly identical",
  70: "Same subject, different angle",
  50: "Same category",
  30: "Very broad match",
};

export default function SearchPage() {
  const [queryImage, setQueryImage] = useState<File | null>(null);
  const [threshold, setThreshold] = useState([70]);
  const [topK, setTopK] = useState([10]);
  
  const searchMutation = useSearchImages();

  const handleUpload = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setQueryImage(file);
    performSearch(file, threshold[0], topK[0]);
  };

  const performSearch = (file: File | null, thresh: number, limit: number) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append("query", file);
    formData.append("threshold", thresh.toString());
    formData.append("topK", limit.toString());

    searchMutation.mutate({ data: { query: file, threshold: thresh, topK: limit } as any });
  };

  const handleThresholdChange = (val: number[]) => {
    setThreshold(val);
    if (queryImage) {
      performSearch(queryImage, val[0], topK[0]);
    }
  };

  const handleTopKChange = (val: number[]) => {
    setTopK(val);
    if (queryImage) {
      performSearch(queryImage, threshold[0], val[0]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  };

  const results = searchMutation.data?.results || [];

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Visual Search</h1>
            <p className="text-muted-foreground text-lg">Find visually similar images across your entire dataset.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Search Controls */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Query Image
                  </h3>
                  <ImageUpload 
                    onUpload={handleUpload} 
                    value={queryImage} 
                    isUploading={searchMutation.isPending}
                    text="Upload query image"
                  />
                </div>

                <div className="space-y-6 pt-4 border-t">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Similarity Threshold</label>
                      <span className="text-sm font-mono text-muted-foreground">{threshold[0]}%</span>
                    </div>
                    <Slider 
                      value={threshold} 
                      onValueChange={handleThresholdChange} 
                      max={100} 
                      step={1} 
                      className="py-2"
                    />
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>
                        {THRESHOLD_LABELS[Object.keys(THRESHOLD_LABELS).map(Number).reverse().find(k => threshold[0] >= k) || 30]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Max Results (Top K)</label>
                      <span className="text-sm font-mono text-muted-foreground">{topK[0]}</span>
                    </div>
                    <Slider 
                      value={topK} 
                      onValueChange={handleTopKChange} 
                      max={50} 
                      min={1}
                      step={1} 
                      className="py-2"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Results Area */}
            <div className="lg:col-span-2">
              {searchMutation.isPending ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl">
                  <div className="animate-pulse flex flex-col items-center">
                    <Search className="w-10 h-10 text-muted-foreground mb-4 animate-bounce" />
                    <p className="text-lg font-medium text-muted-foreground">Scanning database...</p>
                  </div>
                </div>
              ) : !queryImage ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-medium text-foreground mb-2">Ready to Search</h3>
                  <p className="text-muted-foreground max-w-sm text-center">
                    Upload an image to the left to find visually similar matches in your database.
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                  <Search className="w-10 h-10 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No matches found</p>
                  <p className="text-muted-foreground text-sm mt-1">Try lowering the similarity threshold.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Results</h3>
                    <Badge variant="secondary" className="font-mono">{searchMutation.data?.totalFound} matches</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {results.map((result, i) => (
                      <Card key={`${result.id}-${i}`} className="overflow-hidden group animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                        <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                          <img 
                            src={result.imageUrl} 
                            alt={result.filename}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2">
                            <Badge variant="outline" className={cn("font-mono shadow-sm backdrop-blur-md bg-background/90", getScoreColor(result.score))}>
                              {result.score.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3 border-t bg-card">
                          <p className="text-xs font-medium truncate" title={result.filename}>
                            {result.filename}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
