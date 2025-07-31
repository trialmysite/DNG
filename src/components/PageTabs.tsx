import React from 'react';
import { Plus, X, FileText } from 'lucide-react';
import type { ScorePage } from '../types/music';

interface PageTabsProps {
  pages: ScorePage[];
  currentPageId: string;
  onPageSelect: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
}

const PageTabs: React.FC<PageTabsProps> = ({
  pages,
  currentPageId,
  onPageSelect,
  onAddPage,
  onDeletePage,
}) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6">
      <div className="flex items-center gap-2 overflow-x-auto">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`flex items-center gap-3 px-6 py-4 border-b-2 cursor-pointer group transition-all duration-300 ${
              currentPageId === page.id
                ? 'border-purple-500 bg-gray-700 text-purple-300'
                : 'border-transparent hover:border-gray-500 hover:bg-gray-700/50 text-gray-300 hover:text-white'
            }`}
            onClick={() => onPageSelect(page.id)}
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">{page.title}</span>
            <span className="text-xs bg-gray-600 px-2 py-1 rounded-full">
              {page.notes.length}
            </span>
            {pages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePage(page.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all duration-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        
        <button
          onClick={onAddPage}
          className="flex items-center gap-2 px-4 py-4 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-300 ml-2"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Page</span>
        </button>
      </div>
    </div>
  );
};

export default PageTabs;