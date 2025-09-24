class UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user

  # /users/:id (HTML/JSON)
  def show
    respond_to do |format|
      format.html
      format.json do
        counts = {
          posts: @user.posts.count,
          pins: @user.pins.count,
          followers: @user.followers.count,
          following: @user.following.count
        }

        render json: {
          id: @user.id,
          username: @user.username,
          display_name: @user.full_name,
          company: @user.company,
          department: @user.department,
          work_location: @user.work_location,
          bio: @user.bio,
          counts: counts
        }
      end
    end
  end

  # /users/:id/pins.json
  def pins
    pins = @user.pins
                .select(:id, :name, :address, :google_place_id, :latitude, :longitude, :created_at)
                .map { |p|
                  { id: p.id, name: p.name, address: p.address,
                    google_place_id: p.google_place_id,
                    latitude: p.latitude, longitude: p.longitude,
                    posts_count: p.respond_to?(:posts_count) ? p.posts_count : p.posts.size }
                }
    render json: pins
  end

  # /users/:id/posts.json
  def posts
    posts = @user.posts.order(created_at: :desc).map { |p|
      {
        id: p.id,
        title: p.title,
        body: p.body,
        created_at: p.created_at,
        media: []
      }
    }
    render json: posts
  end

  private

  def set_user
    @user = User.find(params[:id])
  end
end
