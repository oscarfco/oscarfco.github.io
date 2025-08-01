import tkinter as tk
from tkinter import ttk

class Scoreboard:
    def __init__(self, root):
        self.root = root
        self.root.title("Scoreboard")
        self.teams = {}  # Dictionary to store team names and their scores
        self.current_frame = None
        self.setup_initial_screen()

    def setup_initial_screen(self):
        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="10")
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Team name entry
        ttk.Label(self.current_frame, text="Enter team name:").grid(row=0, column=0, pady=5)
        self.team_entry = ttk.Entry(self.current_frame)
        self.team_entry.grid(row=0, column=1, pady=5)

        # Add team button
        ttk.Button(self.current_frame, text="Add Team", command=self.add_team).grid(row=0, column=2, pady=5, padx=5)

        # Start game button
        ttk.Button(self.current_frame, text="Start Game", command=self.show_game_screen).grid(row=1, column=0, columnspan=3, pady=10)

        # Display added teams
        self.teams_display = ttk.Frame(self.current_frame)
        self.teams_display.grid(row=2, column=0, columnspan=3, pady=5)
        self.update_teams_display()

    def add_team(self):
        team_name = self.team_entry.get().strip()
        if team_name and team_name not in self.teams:
            self.teams[team_name] = 0
            self.team_entry.delete(0, tk.END)
            self.update_teams_display()

    def update_teams_display(self):
        for widget in self.teams_display.winfo_children():
            widget.destroy()

        for i, team in enumerate(self.teams):
            ttk.Label(self.teams_display, text=f"{team}").grid(row=i, column=0, pady=2)

    def show_game_screen(self):
        if len(self.teams) < 2:
            return  # Need at least 2 teams to start

        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="10")
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Create score buttons for each team
        for i, (team, score) in enumerate(self.teams.items()):
            ttk.Label(self.current_frame, text=team).grid(row=i, column=0, pady=5)
            ttk.Label(self.current_frame, text=str(score)).grid(row=i, column=1, pady=5)
            ttk.Button(self.current_frame, text="+1", 
                      command=lambda t=team: self.increment_score(t)).grid(row=i, column=2, pady=5, padx=5)

        # End round button
        ttk.Button(self.current_frame, text="End Round", 
                  command=self.show_results_screen).grid(row=len(self.teams), column=0, columnspan=3, pady=10)

    def increment_score(self, team):
        self.teams[team] += 1
        self.show_game_screen()  # Refresh the screen to show updated scores

    def show_results_screen(self):
        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="10")
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Sort teams by score
        sorted_teams = sorted(self.teams.items(), key=lambda x: x[1], reverse=True)

        # Display rankings
        ttk.Label(self.current_frame, text="Rankings", font=('Arial', 16, 'bold')).grid(row=0, column=0, columnspan=2, pady=10)
        
        for i, (team, score) in enumerate(sorted_teams, 1):
            ttk.Label(self.current_frame, text=f"{i}. {team}").grid(row=i, column=0, pady=5)
            ttk.Label(self.current_frame, text=str(score)).grid(row=i, column=1, pady=5)

        # Next round button
        ttk.Button(self.current_frame, text="Next Round", 
                  command=self.show_game_screen).grid(row=len(self.teams)+1, column=0, columnspan=2, pady=10)

def main():
    root = tk.Tk()
    app = Scoreboard(root)
    root.mainloop()

if __name__ == "__main__":
    main()
