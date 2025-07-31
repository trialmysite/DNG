"use client"

import React, { useState } from "react"
import HomePage from "./components/HomePage"
import ProjectHeader from "./components/ProjectHeader"
import PageTabs from "./components/PageTabs"
import NotePalette from "./components/NotePalette"
import ScoreSheet from "./components/ScoreSheet"
import { useProjectManager } from "./hooks/useProjectManager"
import { useScoreProject } from "./hooks/useScoreProject"
import type { Notation } from "./data/notations" // <--- Changed from Note to Notation

function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  // Changed selectedNote to selectedNotation and its type to Notation
  const [selectedNotation, setSelectedNotation] = useState<Notation | null>(null)
  const [selectedAccidental, setSelectedAccidental] = useState<string | null>(null)

  const { projects, createProject, deleteProject, loadProject, saveProject } = useProjectManager()

  // Ensure useScoreProject's project and currentPage types are consistent with PlacedNotation
  const {
    project,
    currentPage,
    setCurrentProject,
    updateProjectTitle,
    addPage,
    deletePage,
    setCurrentPage,
    addNoteToCurrentPage, // This function should now expect PlacedNotation
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
    setCurrentProject(null as any) // Reset current project
  }

  const handleDeleteProject = (projectId: string) => {
    deleteProject(projectId)
    if (currentProjectId === projectId) {
      handleBackToHome()
    }
  }

  // Auto-save project when it changes
  React.useEffect(() => {
    if (project && currentProjectId) {
      saveProject(project)
    }
  }, [project, currentProjectId, saveProject])

  // Show homepage if no project is selected
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
          selectedNotation={selectedNotation} // <--- Changed prop name
          onNotationSelect={setSelectedNotation} // <--- Changed prop name
          selectedAccidental={selectedAccidental}
          onAccidentalSelect={setSelectedAccidental}
        />
        <ScoreSheet
          selectedNotation={selectedNotation} // <--- Changed prop name
          selectedAccidental={selectedAccidental}
          currentPage={currentPage}
          onAddNote={addNoteToCurrentPage}
          onRemoveNote={removeNoteFromCurrentPage}
          onClearPage={clearCurrentPage}
          onUpdatePageSettings={updatePageSettings}
        />
      </div>
    </div>
  )
}

export default App
