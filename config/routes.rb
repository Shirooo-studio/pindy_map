Rails.application.routes.draw do
  devise_for :users, controllers: { registrations: "users/registrations" }

  authenticated :user do
    root "pins#index", as: :authenticated_root
  end
  unauthenticated do
    devise_scope :user do
      root to: "devise/sessions#new", as: :unauthenticated_root
    end
  end

  get "/", to: redirect { |params, request|
    request.env[ "warden" ].authenticate? ? "/pins" : "/users/sign_in"
  }, as: :root

  resources :pins do
    collection { get :check }
  end
  resources :posts do
    collection { get :by_place }
  end

  get "/me", to: "mypage#show"

  resource :profile, only: [ :show, :new, :create, :edit, :update ]

  resources :users, only: [ :show ] do
    member do
      get :pins
      get :posts
    end
  end

  resource :me, only: [] do
    get :pins
    get :posts
  end

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest

  # Defines the root path route ("/")
  # root "posts#index"
end
