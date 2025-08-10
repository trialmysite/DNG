"use client"

import React, { useState } from "react"
import HomePage from "./components/HomePage"
import ProjectHeader from "./components/ProjectHeader"
import PageTabs from "./components/PageTabs"
import NotePalette from "./components/NotePalette"
import ScoreSheet from "./components/ScoreSheet"
import RightSidebar from "./components/RightSidebar"
import { useProjectManager } from "./hooks/useProjectManager"
import { useScoreProject } from "./hooks/useScoreProject"
import type { Notation } from "./data/notations"

export interface TextElement {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
}

export interface ArticulationElement {
  id: string
  type: string
  name: string
  symbol: string
  x: number
  y: number
}

function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [selectedNotation, setSelectedNotation] = useState<Notation | null>(null)
  const [selectedAccidental, setSelectedAccidental] = useState<string | null>(null)
  const [selectedArticulation, setSelectedArticulation] = useState<string | null>(null)
  const [isTextMode, setIsTextMode] = useState(false)
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [articulationElements, setArticulationElements] = useState<ArticulationElement[]>([])

  const { projects, createProject, deleteProject, loadProject, saveProject } = useProjectManager()

  const {
    project,
    currentPage,
    setCurrentProject,
    updateProjectTitle,
    addPage,
    deletePage,
    setCurrentPage,
    addNoteToCurrentPage,
    removeNoteFromCurrentPage,
    clearCurrentPage,
    updatePageSettings,
  } = useScoreProject()

  const handleCreateProject = (title: string, composer: string, description?: string) => {
    const projectId = createProject(title, composer, description)
    const newProject = loadProject(projectId)
    if (newProject) {
      setCurrentProject(newProject)
      setCurrentProjectId(projectId)
    }
  }

  const handleOpenProject = (projectId: string) => {
    const loadedProject = loadProject(projectId)
    if (loadedProject) {
      setCurrentProject(loadedProject)
      setCurrentProjectId(projectId)
    }
  }

  const handleBackToHome = () => {
    if (project && currentProjectId) {
      saveProject(project)
    }
    setCurrentProjectId(null)
    setCurrentProject(null as any)
  }

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
    if (currentProjectId === projectId) {
      handleBackToHome()
    }
  }

  const handleAddTextElement = (textElement: TextElement) => {
    setTextElements(prev => [...prev, textElement])
  }

  const handleRemoveTextElement = (id: string) => {
    setTextElements(prev => prev.filter(el => el.id !== id))
  }

  const handleUpdateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }

  const handleAddArticulation = (articulation: ArticulationElement) => {
    setArticulationElements(prev => [...prev, articulation])
  }

  const handleRemoveArticulation = (id: string) => {
    setArticulationElements(prev => prev.filter(el => el.id !== id))
  }

  React.useEffect(() => {
    if (project && currentProjectId) {
      saveProject(project)
    }
  }, [project, currentProjectId, saveProject])

  if (!currentProjectId || !project || !currentPage) {
    return (
      <HomePage
        projects={projects}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ProjectHeader project={project} onTitleChange={updateProjectTitle} onBackToHome={handleBackToHome} />
      <PageTabs
        pages={project.pages}
        currentPageId={project.currentPageId}
        onPageSelect={setCurrentPage}
        onAddPage={addPage}
        onDeletePage={deletePage}
      />
      <div className="flex flex-1">
        <NotePalette
          selectedNotation={selectedNotation}
          onNotationSelect={setSelectedNotation}
          selectedAccidental={selectedAccidental}
          onAccidentalSelect={setSelectedAccidental}
        />
        <ScoreSheet
          selectedNotation={selectedNotation}
          selectedAccidental={selectedAccidental}
          currentPage={currentPage}
          onAddNote={addNoteToCurrentPage}
          onRemoveNote={removeNoteFromCurrentPage}
          onClearPage={clearCurrentPage}
          onUpdatePageSettings={updatePageSettings}
          textElements={textElements}
          onAddTextElement={handleAddTextElement}
          onRemoveTextElement={handleRemoveTextElement}
          onUpdateTextElement={handleUpdateTextElement}
          articulationElements={articulationElements}
          onAddArticulation={handleAddArticulation}
          onRemoveArticulation={handleRemoveArticulation}
          selectedArticulation={selectedArticulation}
          isTextMode={isTextMode}
        />
        <RightSidebar
          selectedArticulation={selectedArticulation}
          onArticulationSelect={setSelectedArticulation}
          isTextMode={isTextMode}
          onTextModeToggle={setIsTextMode}
          currentPage={currentPage}
          onUpdatePageSettings={updatePageSettings}
        />
      </div>
    </div>
  )
}

export default App
