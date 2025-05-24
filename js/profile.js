let avatarFile = null;

async function loadProfile() {
  try {
    const res = await fetch("http://localhost:8001/users/me", {
      credentials: "include"
    });

    if (res.status === 401) {
      window.location.href = "/pages/auth.html";
      return;
    }

    const user = await res.json();
    document.getElementById("nickname-text").innerText = user.name || "Нет имени";
    document.getElementById("email-text").innerText = user.email || "Нет email";

    document.getElementById("avatar").src = user.avatar ? `http://localhost:8001/users/avatar/${user.avatar}` : `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.name}`;

    document.getElementById("nickname-input").value = user.name || "";
  } catch (err) {
    console.error("Failed to load profile:", err);
    alert("Failed to load profile");
  }
}

function logout() {
  fetch("http://localhost:8001/auth/logout", {
    method: "POST",
    credentials: "include"
  }).then(() => {
    window.location.href = "/login.html";
  });
}

async function saveProfile() {
  const name = document.getElementById("nickname-input").value;

  const formData = new FormData();
  formData.append("name", name);
  if (avatarFile) formData.append("avatar", avatarFile);

  try {
    const res = await fetch("http://localhost:8001/users/update", {
      method: "PATCH",
      body: formData,
      credentials: "include"
    });

    if (!res.ok) throw new Error("Failed to update");

    loadProfile();
    document.getElementById("nickname-input").classList.add("hidden");
    document.getElementById("save-btn").classList.add("hidden");
    document.getElementById("nickname-text").classList.remove("hidden");
    document.getElementById("cancel-btn").classList.add("hidden");
    document.getElementById("edit-btn").classList.remove("hidden")
    document.getElementById("avatar-label").removeAttribute("for");
  } catch (err) {
    console.error("Failed to save profile:", err);
    alert("Failed to save profile");
  }
}

function editProfile() {
  document.getElementById("nickname-text").classList.add("hidden");
  document.getElementById("edit-btn").classList.add("hidden");
  document.getElementById("nickname-input").classList.remove("hidden");
  document.getElementById("cancel-btn").classList.remove("hidden");
  document.getElementById("save-btn").classList.remove("hidden");
  document.getElementById("avatar-label").setAttribute("for", "avatar-upload");
}

document.getElementById("edit-btn").addEventListener("click", editProfile);

document.getElementById("avatar-upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    avatarFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("avatar").src = reader.result;
    };
    reader.readAsDataURL(file);
  }
});


document.getElementById("back-to-chats").addEventListener("click", () => {
  window.location.href = "/pages/chats.html";
});

document.getElementById("cancel-btn").addEventListener("click", () => {
  document.getElementById("nickname-input").classList.add("hidden");
  document.getElementById("save-btn").classList.add("hidden");
  document.getElementById("nickname-text").classList.remove("hidden");
  document.getElementById("cancel-btn").classList.add("hidden");
  document.getElementById("edit-btn").classList.remove("hidden")
  document.getElementById("avatar-label").removeAttribute("for");
});

loadProfile();
