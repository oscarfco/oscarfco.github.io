import tkinter as tk
from tkinter import ttk

class Scoreboard:
    def __init__(self, root):
        self.root = root
        self.root.title("Scoreboard")
        self.teams = {}
        self.current_frame = None
        self.score_labels = {}
        
        # Define color scheme
        self.colors = {
            'bg': '#2C3E50',  # Dark blue-gray
            'fg': '#ECF0F1',  # Light gray
            'accent': '#3498DB',  # Bright blue
            'button': '#2980B9',  # Darker blue
            'header': '#E74C3C'   # Red
        }
        
        # Configure root window
        self.root.configure(bg=self.colors['bg'])
        self.style = ttk.Style()
        self.style.configure('Custom.TFrame', background=self.colors['bg'])
        self.style.configure('Custom.TLabel', 
                           background=self.colors['bg'], 
                           foreground=self.colors['fg'])
        self.style.configure('Custom.TButton',
                           background=self.colors['button'],
                           foreground=self.colors['fg'],
                           padding=10)
        self.style.configure('Header.TLabel',
                           background=self.colors['bg'],
                           foreground=self.colors['header'],
                           font=('Arial', 16, 'bold'))
        self.style.configure('Custom.TEntry', 
                           fieldbackground=self.colors['fg'],
                           foreground=self.colors['bg'])
        
        self.setup_initial_screen()

    def setup_initial_screen(self):
        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="20", style='Custom.TFrame')
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Team name entry
        ttk.Label(self.current_frame, text="Enter team name:", style='Custom.TLabel').grid(row=0, column=0, pady=10)
        self.team_entry = ttk.Entry(self.current_frame, style='Custom.TEntry')
        self.team_entry.grid(row=0, column=1, pady=10, padx=5)

        # Add team button
        ttk.Button(self.current_frame, text="Add Team", 
                  style='Custom.TButton', command=self.add_team).grid(row=0, column=2, pady=10, padx=5)

        # Start game button
        ttk.Button(self.current_frame, text="Start Game", 
                  style='Custom.TButton', command=self.show_game_screen).grid(row=1, column=0, columnspan=3, pady=20)

        # Display added teams
        self.teams_display = ttk.Frame(self.current_frame, style='Custom.TFrame')
        self.teams_display.grid(row=2, column=0, columnspan=3, pady=10)
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
            return

        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="20", style='Custom.TFrame')
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.score_labels = {}
        self.score_entries = {}
        
        # Header labels
        ttk.Label(self.current_frame, text="Team", style='Header.TLabel').grid(row=0, column=0, pady=10)
        ttk.Label(self.current_frame, text="Total Score", style='Header.TLabel').grid(row=0, column=1, pady=10)
        ttk.Label(self.current_frame, text="Add Points", style='Header.TLabel').grid(row=0, column=2, pady=10)

        for i, (team, score) in enumerate(self.teams.items(), 1):
            ttk.Label(self.current_frame, text=team, style='Custom.TLabel').grid(row=i, column=0, pady=8)
            score_label = ttk.Label(self.current_frame, text=str(score), style='Custom.TLabel')
            score_label.grid(row=i, column=1, pady=8)
            self.score_labels[team] = score_label
            
            score_entry = ttk.Entry(self.current_frame, width=10, style='Custom.TEntry')
            score_entry.grid(row=i, column=2, pady=8, padx=10)
            self.score_entries[team] = score_entry

        # Buttons frame
        button_frame = ttk.Frame(self.current_frame, style='Custom.TFrame')
        button_frame.grid(row=len(self.teams)+1, column=0, columnspan=3, pady=20)
        
        ttk.Button(button_frame, text="Update Scores", 
                  style='Custom.TButton', command=self.update_all_scores).grid(row=0, column=0, padx=10)
        ttk.Button(button_frame, text="End Round", 
                  style='Custom.TButton', command=self.show_results_screen).grid(row=0, column=1, padx=10)

    def update_all_scores(self):
        for team, entry in self.score_entries.items():
            try:
                points = int(entry.get().strip() or "0")
                self.teams[team] += points
                self.score_labels[team].config(text=str(self.teams[team]))
                entry.delete(0, tk.END)  # Clear the entry after updating
            except ValueError:
                # If invalid input, just skip that team
                continue

    def show_results_screen(self):
        if self.current_frame:
            self.current_frame.destroy()

        self.current_frame = ttk.Frame(self.root, padding="20", style='Custom.TFrame')
        self.current_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Display header
        ttk.Label(self.current_frame, text="Final Rankings", 
                 style='Header.TLabel').grid(row=0, column=0, columnspan=2, pady=(0,20))
        
        # Rankings frame
        rankings_frame = ttk.Frame(self.current_frame, style='Custom.TFrame')
        rankings_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
        sorted_teams = sorted(self.teams.items(), key=lambda x: -x[1])
        for i, (team, score) in enumerate(sorted_teams, 1):
            rank_text = f"{i}. {team}"
            if i == 1:
                rank_text += " 🏆"
            ttk.Label(rankings_frame, text=rank_text, 
                     style='Custom.TLabel').grid(row=i, column=0, pady=5, sticky=tk.W)
            ttk.Label(rankings_frame, text=str(score), 
                     style='Custom.TLabel').grid(row=i, column=1, pady=5, padx=(30,0), sticky=tk.E)

        # Next round button
        ttk.Button(self.current_frame, text="Next Round", 
                  style='Custom.TButton', command=self.show_game_screen).grid(row=2, column=0, columnspan=2, pady=20)

def main():
    root = tk.Tk()
    app = Scoreboard(root)
    root.mainloop()

if __name__ == "__main__":
    main()
